// src/utils/payCard.js
//
// Drives a gateway's card form to completion.
//
// ⚠ This only works against a SANDBOX gateway.
//
// Indian card payments are subject to RBI's additional-factor authentication
// rule: the issuing bank sends a one-time password to the cardholder's phone
// and the payment cannot proceed without it. An automated browser has no way
// to read that OTP, so a real ₹1 production payment cannot be completed
// unattended — no amount of automation gets around it. UPI (approval in the
// payer's app) and netbanking (bank login) have the same problem.
//
// In sandbox mode the gateways publish test cards whose OTP is a fixed,
// documented value, which is what PAYMENT_CARD_OTP is for. Point
// PAYMENT_API_URL at a staging payment-backend running with
// CASHFREE_ENVIRONMENT=TEST (or Razorpay test keys) and the whole chain —
// checkout → payment → callback/webhook → order → access activation — runs
// end to end without a human.
//
// The selectors below are written defensively: gateway checkout markup changes
// without notice, so each field is looked up by several plausible selectors and
// a miss produces a message naming the field rather than a bare timeout.

const FIRST_MATCH_TIMEOUT = 8000;

/** Try a list of selectors across every frame; return the first that exists. */
async function findField(page, selectors, { timeout = FIRST_MATCH_TIMEOUT } = {}) {
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
        for (const frame of page.frames()) {
            for (const selector of selectors) {
                const locator = frame.locator(selector).first();
                try {
                    if ((await locator.count()) > 0 && (await locator.isVisible())) {
                        return locator;
                    }
                } catch {
                    // Frame detached mid-search — normal on gateway pages that
                    // swap iframes as you move through the flow.
                }
            }
        }
        await page.waitForTimeout(400);
    }
    return null;
}

async function fillField(page, label, selectors, value) {
    const field = await findField(page, selectors);
    if (!field) {
        throw new Error(
            `Could not find the "${label}" field on the gateway checkout. ` +
            'The gateway markup has probably changed — update src/utils/payCard.js.'
        );
    }
    await field.click();
    await field.fill('').catch(() => { });
    await field.pressSequentially(value, { delay: 40 });
    return true;
}

/**
 * Fill the card form and submit it.
 *
 * @returns {Promise<{submitted: boolean, otpEntered: boolean}>}
 */
export async function payWithCard(page, card, { log } = {}) {
    const note = (m) => log?.info?.(m);

    // Some checkouts open on a method chooser rather than the card form.
    const cardTab = await findField(
        page,
        [
            'text=/^\\s*(Credit|Debit)\\s*(\\/|or)?\\s*(Debit|Credit)?\\s*Card/i',
            '[data-testid*="card"]',
            '#card',
            'button:has-text("Card")',
        ],
        { timeout: 5000 }
    );
    if (cardTab) {
        await cardTab.click().catch(() => { });
        await page.waitForTimeout(1500);
        note('selected the card payment method');
    }

    await fillField(
        page,
        'card number',
        [
            'input[name*="cardnumber" i]',
            'input[name*="card_number" i]',
            'input[id*="cardnumber" i]',
            'input[id*="card-number" i]',
            'input[autocomplete="cc-number"]',
            'input[placeholder*="card number" i]',
            'input[placeholder*="1234" i]',
        ],
        card.number
    );

    // Expiry is sometimes one MM/YY field, sometimes two.
    const combinedExpiry = await findField(
        page,
        [
            'input[autocomplete="cc-exp"]',
            'input[name*="expiry" i]:not([name*="month" i]):not([name*="year" i])',
            'input[placeholder*="MM / YY" i]',
            'input[placeholder*="MM/YY" i]',
        ],
        { timeout: 3000 }
    );

    if (combinedExpiry) {
        await combinedExpiry.click();
        await combinedExpiry.pressSequentially(`${card.expiryMonth}${card.expiryYear}`, { delay: 40 });
    } else {
        await fillField(
            page,
            'expiry month',
            ['input[name*="month" i]', 'input[id*="month" i]', 'select[name*="month" i]'],
            card.expiryMonth
        );
        await fillField(
            page,
            'expiry year',
            ['input[name*="year" i]', 'input[id*="year" i]', 'select[name*="year" i]'],
            card.expiryYear
        );
    }

    await fillField(
        page,
        'CVV',
        [
            'input[name*="cvv" i]',
            'input[name*="cvc" i]',
            'input[id*="cvv" i]',
            'input[autocomplete="cc-csc"]',
            'input[placeholder*="CVV" i]',
        ],
        card.cvv
    );

    // Cardholder name is optional on several checkouts.
    const holder = await findField(
        page,
        [
            'input[name*="cardholder" i]',
            'input[name*="card_holder" i]',
            'input[autocomplete="cc-name"]',
            'input[placeholder*="name on card" i]',
        ],
        { timeout: 2500 }
    );
    if (holder && card.holder) {
        await holder.click();
        await holder.pressSequentially(card.holder, { delay: 30 });
    }

    const payButton = await findField(page, [
        'button:has-text("Pay")',
        'button[type="submit"]',
        'input[type="submit"]',
        '[data-testid*="pay" i]',
    ]);
    if (!payButton) {
        throw new Error('Card details were entered but no Pay button could be found on the checkout.');
    }
    await payButton.click();
    note('submitted the card form');

    // ── OTP ────────────────────────────────────────────────────────────────
    // Present in sandbox with a fixed value; in production the real OTP goes
    // to a phone and this is where an unattended run dies.
    let otpEntered = false;
    if (card.otp) {
        await page.waitForTimeout(4000);
        const otpField = await findField(
            page,
            [
                'input[name*="otp" i]',
                'input[id*="otp" i]',
                'input[placeholder*="OTP" i]',
                'input[autocomplete="one-time-code"]',
                'input[type="tel"][maxlength="6"]',
            ],
            { timeout: 20000 }
        );

        if (otpField) {
            await otpField.click();
            await otpField.pressSequentially(card.otp, { delay: 60 });

            const submitOtp = await findField(page, [
                'button:has-text("Submit")',
                'button:has-text("Verify")',
                'button:has-text("Proceed")',
                'button[type="submit"]',
                'input[type="submit"]',
            ]);
            if (submitOtp) await submitOtp.click();
            otpEntered = true;
            note('submitted the sandbox OTP');
        } else {
            note('no OTP field appeared — the gateway completed without one');
        }
    }

    return { submitted: true, otpEntered };
}

export default payWithCard;
