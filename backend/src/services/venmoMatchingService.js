const db = require('../db/connection');
const gmailConfig = require('../../config/gmail.config');
const { extractTrackingId } = require('../utils/trackingId');

class VenmoMatchingService {
  /**
   * Calculate similarity between two strings (Levenshtein distance)
   */
  calculateStringSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    str1 = str1.toLowerCase().trim();
    str2 = str2.toLowerCase().trim();
    
    if (str1 === str2) return 1;
    
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(str1, str2) {
    const track = Array(str2.length + 1).fill(null).map(() =>
      Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i += 1) {
      track[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j += 1) {
      track[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j += 1) {
      for (let i = 1; i <= str1.length; i += 1) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        track[j][i] = Math.min(
          track[j][i - 1] + 1,
          track[j - 1][i] + 1,
          track[j - 1][i - 1] + indicator,
        );
      }
    }
    
    return track[str2.length][str1.length];
  }

  /**
   * Match a payment email to a payment request
   */
  async matchPaymentEmail(emailRecord) {
    console.log(`🔍 Attempting to match payment email: $${emailRecord.venmo_amount} from ${emailRecord.venmo_actor}`);
    
    try {
      // SPECIAL RULE: Rent detection (Ushi payment >= $1600 from Aug 2025 onwards)
      const isUshi = emailRecord.venmo_actor && 
        (emailRecord.venmo_actor.toLowerCase().includes('ushi') || 
         emailRecord.venmo_actor.toLowerCase().includes(process.env.ROOMMATE_NAME?.toLowerCase() || 'ushi'));
      
      if (isUshi && emailRecord.venmo_amount >= 1600) {
        const emailDate = new Date(emailRecord.received_date);
        
        // Only apply this rule from August 2025 onwards
        if (emailDate >= new Date('2025-08-01')) {
          console.log(`🏠 Detected rent payment: $${emailRecord.venmo_amount} from Ushi`);
          
          // Find the rent payment request for this month
          const month = emailDate.getMonth() + 1;
          const year = emailDate.getFullYear();
          
          const rentRequest = await db.getOne(`
            SELECT pr.*, ub.bill_type
            FROM payment_requests pr
            LEFT JOIN utility_bills ub ON pr.utility_bill_id = ub.id
            WHERE pr.status = 'pending'
              AND EXTRACT(MONTH FROM pr.created_at) = $1
              AND EXTRACT(YEAR FROM pr.created_at) = $2
              AND pr.amount >= 1600
            ORDER BY pr.created_at DESC
            LIMIT 1
          `, [month, year]);
          
          if (rentRequest) {
            console.log(`✅ Matched to rent payment request #${rentRequest.id}`);
            await this.applyMatch(emailRecord, { ...rentRequest, confidence: 1.0 });
            return { 
              matched: true, 
              payment_request_id: rentRequest.id,
              confidence: 1.0,
              match_method: 'rent_rule'
            };
          } else {
            console.log(`⚠️ No rent payment request found for ${month}/${year}, storing as rent income`);
            // Could create a rent transaction here if needed
          }
        }
      }
      // First, try to match by tracking ID if available
      if (emailRecord.tracking_id) {
        console.log(`🏷️  Found tracking ID in email: ${emailRecord.tracking_id}`);
        
        const trackingMatch = await db.getOne(`
          SELECT pr.*, vpr.recipient_name, ub.bill_type
          FROM payment_requests pr
          LEFT JOIN venmo_payment_requests vpr ON pr.utility_bill_id = vpr.utility_bill_id
          LEFT JOIN utility_bills ub ON pr.utility_bill_id = ub.id
          WHERE pr.tracking_id = $1
            AND pr.status = 'pending'
        `, [emailRecord.tracking_id]);
        
        if (trackingMatch) {
          console.log(`✅ Found exact match via tracking ID: Payment Request #${trackingMatch.id}`);
          
          // Update payment request as paid
          await db.query(`
            UPDATE payment_requests 
            SET status = 'paid', 
                paid_date = $1,
                updated_at = NOW()
            WHERE id = $2
          `, [emailRecord.received_date, trackingMatch.id]);
          
          // Update email with match
          await db.query(`
            UPDATE venmo_emails 
            SET payment_request_id = $1, 
                matched = true,
                confidence_score = 1.0
            WHERE id = $2
          `, [trackingMatch.id, emailRecord.id]);
          
          return { 
            matched: true, 
            payment_request_id: trackingMatch.id,
            confidence: 1.0,
            match_method: 'tracking_id'
          };
        }
      }
      
      // If no tracking ID match, fall back to fuzzy matching
      console.log('🔍 No tracking ID match, falling back to fuzzy matching...');
      
      // Find potential payment request matches - NO TIME WINDOW
      // Just match by amount and name
      const potentialMatches = await db.getMany(`
        SELECT pr.*, vpr.recipient_name, ub.bill_type
        FROM payment_requests pr
        LEFT JOIN venmo_payment_requests vpr ON pr.utility_bill_id = vpr.utility_bill_id
        LEFT JOIN utility_bills ub ON pr.utility_bill_id = ub.id
        WHERE pr.status = 'pending'
          AND ABS(pr.amount - $1) <= $2
        ORDER BY ABS(pr.amount - $1) ASC, pr.created_at DESC
      `, [
        emailRecord.venmo_amount,
        gmailConfig.matching.amountTolerance
      ]);
      
      if (potentialMatches.length === 0) {
        console.log('❌ No potential matches found based on amount and time window');
        return { matched: false, reason: 'no_candidates' };
      }
      
      console.log(`📋 Found ${potentialMatches.length} potential matches`);
      
      // Calculate confidence scores for each match
      const matchScores = potentialMatches.map(request => {
        const scores = {
          request_id: request.id,
          amount_match: 1 - Math.abs(parseFloat(request.amount) - emailRecord.venmo_amount) / parseFloat(request.amount),
          name_match: this.calculateStringSimilarity(
            emailRecord.venmo_actor,
            request.recipient_name || request.roommate_name || process.env.ROOMMATE_NAME || 'Ushi Lo'
          ),
          note_match: 0
        };
        
        // Check if note contains bill type keywords
        if (emailRecord.venmo_note && request.bill_type) {
          const noteKeywords = {
            'electricity': ['pge', 'pg&e', 'electric', 'power'],
            'water': ['water', 'great oaks']
          };
          
          const keywords = noteKeywords[request.bill_type] || [];
          const noteMatch = keywords.some(keyword => 
            emailRecord.venmo_note.toLowerCase().includes(keyword)
          );
          
          scores.note_match = noteMatch ? 1 : 0;
        }
        
        // Calculate weighted confidence score (no time proximity)
        scores.confidence = (
          scores.amount_match * 0.5 +    // Amount is most important
          scores.name_match * 0.35 +     // Name is second most important
          scores.note_match * 0.15        // Note keywords are helpful
        );
        
        return {
          ...request,
          ...scores
        };
      });
      
      // Sort by confidence score
      matchScores.sort((a, b) => b.confidence - a.confidence);
      const bestMatch = matchScores[0];
      
      console.log(`🎯 Best match: Request #${bestMatch.id} with confidence ${(bestMatch.confidence * 100).toFixed(1)}%`);
      
      // Auto-match if confidence is high enough
      if (bestMatch.confidence >= gmailConfig.matching.minConfidence) {
        await this.applyMatch(emailRecord, bestMatch);
        return { 
          matched: true, 
          payment_request_id: bestMatch.id,
          confidence: bestMatch.confidence 
        };
      } else {
        // Store for manual review
        await db.insert('venmo_unmatched_emails', {
          venmo_email_id: emailRecord.id,
          potential_matches: JSON.stringify(matchScores.slice(0, 3)), // Top 3 matches
          resolution_status: 'pending'
        });
        
        console.log('⚠️  Confidence too low for auto-match, flagged for manual review');
        
        await db.query(
          'UPDATE venmo_emails SET manual_review_needed = true, review_reason = $1 WHERE id = $2',
          [`Low confidence: ${(bestMatch.confidence * 100).toFixed(1)}%`, emailRecord.id]
        );
        
        return { 
          matched: false, 
          reason: 'low_confidence',
          best_confidence: bestMatch.confidence 
        };
      }
      
    } catch (error) {
      console.error('❌ Error matching payment email:', error);
      throw error;
    }
  }

  /**
   * Apply a confirmed match between email and payment request
   */
  async applyMatch(emailRecord, paymentRequest) {
    const client = await db.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 1. Update venmo_emails with match
      await client.query(`
        UPDATE venmo_emails 
        SET matched = true,
            payment_request_id = $1,
            match_confidence = $2,
            processing_notes = $3
        WHERE id = $4
      `, [
        paymentRequest.id,
        paymentRequest.confidence,
        `Auto-matched with confidence ${(paymentRequest.confidence * 100).toFixed(1)}%`,
        emailRecord.id
      ]);
      
      // 2. Update payment_requests status
      await client.query(`
        UPDATE payment_requests 
        SET status = 'paid',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [paymentRequest.id]);
      
      // 3. Update venmo_payment_requests if exists
      if (paymentRequest.venmo_request_id) {
        await client.query(`
          UPDATE venmo_payment_requests 
          SET status = 'paid',
              paid_date = $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [emailRecord.received_date, paymentRequest.venmo_request_id]);
      }
      
      // 4. Create utility adjustment (recuperation) transaction
      await this.createRecuperationTransaction(client, paymentRequest, emailRecord);
      
      // 5. Send Discord notification
      const discordService = require('./discordService');
      await discordService.sendPaymentReceivedNotification({
        amount: emailRecord.venmo_amount,
        payer: emailRecord.venmo_actor,
        bill_type: paymentRequest.bill_type,
        month: paymentRequest.month,
        year: paymentRequest.year,
        note: emailRecord.venmo_note
      });
      
      await client.query('COMMIT');
      
      console.log(`✅ Successfully matched and processed payment for request #${paymentRequest.id}`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create recuperation transaction for roommate payment
   */
  async createRecuperationTransaction(client, paymentRequest, emailRecord) {
    // Create a recuperation transaction (negative amount = income)
    const recuperationTx = await client.query(`
      INSERT INTO transactions (
        plaid_id,
        account_id,
        amount,
        date,
        name,
        merchant_name,
        category,
        subcategory,
        expense_type
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      ) RETURNING id
    `, [
      `venmo_recuperation_${paymentRequest.id}_${Date.now()}`,
      'manual_entry',
      -emailRecord.venmo_amount, // Negative for income
      emailRecord.received_date,
      `Utility Recuperation - ${emailRecord.venmo_actor}`,
      'Venmo',
      'Transfer',
      'Roommate Payment',
      'utility_recuperation'
    ]);
    
    // Create utility adjustment record
    await client.query(`
      INSERT INTO utility_adjustments (
        transaction_id,
        payment_request_id,
        adjustment_amount,
        adjustment_type,
        description,
        applied_date
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      recuperationTx.rows[0].id,
      paymentRequest.id,
      emailRecord.venmo_amount,
      'reimbursement',
      `Venmo payment from ${emailRecord.venmo_actor} - ${emailRecord.venmo_note || 'No note'}`,
      emailRecord.received_date
    ]);
    
    console.log(`💰 Created recuperation transaction for $${emailRecord.venmo_amount}`);
  }

  /**
   * Get unmatched emails requiring manual review
   */
  async getUnmatchedEmails() {
    // Get ALL unmatched emails, not just those in the venmo_unmatched_emails table
    return await db.getMany(`
      SELECT 
        ve.*,
        vue.potential_matches,
        vue.resolution_status
      FROM venmo_emails ve
      LEFT JOIN venmo_unmatched_emails vue ON ve.id = vue.venmo_email_id
      WHERE ve.matched = false
        OR vue.resolution_status = 'pending'
      ORDER BY ve.received_date DESC
    `);
  }

  /**
   * Manually match an email to a payment request
   */
  async manualMatch(emailId, paymentRequestId) {
    const emailRecord = await db.getOne(
      'SELECT * FROM venmo_emails WHERE id = $1',
      [emailId]
    );
    
    const paymentRequest = await db.getOne(
      'SELECT * FROM payment_requests WHERE id = $1',
      [paymentRequestId]
    );
    
    if (!emailRecord || !paymentRequest) {
      throw new Error('Invalid email or payment request ID');
    }
    
    // Apply the match with manual flag
    await this.applyMatch(emailRecord, {
      ...paymentRequest,
      confidence: 1.0 // Manual match has 100% confidence
    });
    
    // Update unmatched record
    await db.query(`
      UPDATE venmo_unmatched_emails 
      SET resolution_status = 'matched',
          resolved_at = CURRENT_TIMESTAMP,
          resolved_by = 'manual'
      WHERE venmo_email_id = $1
    `, [emailId]);
    
    return { success: true };
  }
}

module.exports = new VenmoMatchingService();