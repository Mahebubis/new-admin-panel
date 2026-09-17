// src/checks/paymentCheckout.js
//
// MVP test #5 — "Checkout / payment".
//
// NO MONEY MOVES. The check goes as far as a student does before they type a
// card number: it creates a real order through the payment API and loads the
// gateway's checkout with the returned session, then abandons it. That covers
// the failure the alert example in the spec describes — "payment gateway did
// not load" — without charging anything.
//
// The callback -> order-creation -> access-activation half of the payment
// journey cannot be exercised without a completed payment. It is covered
// instead by (a) the webhook-reachability probes in the api-health check and
// (b) the order row assertion below, which proves the order was persisted.
// Completing a sandbox payment end to end is possible but needs sandbox
// Cashfree credentials — see README "Payment monitoring".

import { collectConsole, closeQuietly } from '../browser.js';
import { capturePage } from '../utils/artifacts.js';
import { expect } from '../utils/result.js';
import { payWithCard } from '../utils/payCard.js';

const CASHFREE_SDK = 'https://sdk.cashfree.com/js/v3/cashfree.js';
const RAZORPAY_SDK = 'https://checkout.razorpay.com/v1/checkout.js';

export default {
    id: 'payment-checkout',
    name: 'Payment checkout',
    group: 'journey',
    severity: 'critical',
    needsBrowser: true,
    requires: ['registration'],

    async run({ config, recorder, artifactDir, shared, log }) {
        // Reuse the logged-in dashboard tab from the registration check: the
        // payment API reads the session cookie and keys off the Origin header,
        // so the request has to come from the real app origin.
        const page = shared.page;

        await recorder.step('Precondition: logged-in dashboard session', async () => {
            expect(
                page && !page.isClosed(),
                'No logged-in dashboard page available — the registration check must run first.'
            );
            expect(shared.userId, 'No user id available from the registration check.');
            return `user ${shared.userId}`;
        });

        const consoleLines = shared.consoleLines || collectConsole(page);
        let checkoutPage = null;

        try {
            const order = await recorder.step('Create payment order', async () => {
                const endpoint = config.payment.useTestingEndpoint ? 'create-order-testing' : 'create-order';

                const result = await page.evaluate(
                    async ({ base, path, body }) => {
                        const res = await fetch(`${base}/${path}`, {
                            method: 'POST',
                            credentials: 'include',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(body),
                        });
                        const text = await res.text();
                        let json = null;
                        try {
                            json = JSON.parse(text);
                        } catch {
                            json = null;
                        }
                        return { status: res.status, json, text: text.slice(0, 600) };
                    },
                    {
                        base: config.targets.paymentApi,
                        path: endpoint,
                        body: {
                            user_id: Number(shared.userId),
                            internship_name: config.payment.internshipName,
                            batch_date: null,
                            amount: config.payment.amount,
                            return_url: config.payment.returnUrl,
                            refund_program: 0,
                            from: 'monitoring',
                        },
                    }
                );

                expect(
                    result.status < 500,
                    `${endpoint} returned HTTP ${result.status} — ${result.text}`
                );
                expect(
                    result.json && result.json.success,
                    `${endpoint} did not create an order (HTTP ${result.status}): ${result.text}`
                );

                const gateway = result.json.gateway;
                expect(gateway, `Order created but no gateway was selected: ${result.text}`);

                recorder.note('gateway', gateway);
                recorder.note('orderId', result.json.order_id || result.json.original_order_id || null);

                if (gateway === 'cashfree') {
                    expect(
                        result.json.payment_session_id,
                        `Cashfree order has no payment_session_id — checkout cannot open: ${result.text}`
                    );
                } else {
                    expect(
                        result.json.order_id,
                        `Razorpay order has no order_id — checkout cannot open: ${result.text}`
                    );
                }

                return result.json;
            });

            // ── Gateway checkout must actually render ───────────────────────
            checkoutPage = await recorder.step('Load payment gateway checkout', async () => {
                const context = page.context();
                const tab = await context.newPage();
                collectConsole(tab);

                // Start from the dashboard origin so the gateway sees the same
                // referrer/origin it would in production.
                await tab.goto(`${config.targets.dashboard}/`, { waitUntil: 'domcontentloaded' });

                if (order.gateway === 'cashfree') {
                    const loaded = await tab.evaluate(
                        ({ sdk, sessionId }) =>
                            new Promise((resolve) => {
                                const script = document.createElement('script');
                                script.src = sdk;
                                script.onload = async () => {
                                    try {
                                        const cashfree = window.Cashfree({ mode: 'production' });
                                        if (!cashfree || typeof cashfree.checkout !== 'function') {
                                            resolve({ ok: false, error: 'Cashfree SDK loaded but checkout() is missing' });
                                            return;
                                        }
                                        // redirectTarget "_self" navigates this
                                        // tab to the hosted checkout, which is
                                        // what we then assert on.
                                        cashfree.checkout({ paymentSessionId: sessionId, redirectTarget: '_self' });
                                        resolve({ ok: true });
                                    } catch (error) {
                                        resolve({ ok: false, error: error.message });
                                    }
                                };
                                script.onerror = () => resolve({ ok: false, error: 'Cashfree SDK failed to load' });
                                document.head.appendChild(script);
                            }),
                        { sdk: CASHFREE_SDK, sessionId: order.payment_session_id }
                    );

                    expect(loaded.ok, `Cashfree checkout could not be opened: ${loaded.error}`);

                    await tab.waitForURL(/cashfree\.com/, { timeout: config.runtime.stepTimeoutMs }).catch(() => { });
                    expect(
                        /cashfree\.com/.test(tab.url()),
                        `Cashfree checkout never opened — the tab stayed on ${tab.url()}`
                    );
                } else {
                    const opened = await tab.evaluate(
                        ({ sdk, orderId, amount }) =>
                            new Promise((resolve) => {
                                const script = document.createElement('script');
                                script.src = sdk;
                                script.onload = () => {
                                    try {
                                        if (typeof window.Razorpay !== 'function') {
                                            resolve({ ok: false, error: 'Razorpay SDK loaded but window.Razorpay is missing' });
                                            return;
                                        }
                                        const rzp = new window.Razorpay({
                                            key: window.__MONITOR_RAZORPAY_KEY__ || 'rzp_live_hSHClpjDeQT1CQ',
                                            amount: Math.round(Number(amount) * 100),
                                            currency: 'INR',
                                            name: 'Internship Studio',
                                            order_id: orderId,
                                            handler: () => { },
                                        });
                                        rzp.open();
                                        resolve({ ok: true });
                                    } catch (error) {
                                        resolve({ ok: false, error: error.message });
                                    }
                                };
                                script.onerror = () => resolve({ ok: false, error: 'Razorpay SDK failed to load' });
                                document.head.appendChild(script);
                            }),
                        { sdk: RAZORPAY_SDK, orderId: order.order_id, amount: config.payment.amount }
                    );

                    expect(opened.ok, `Razorpay checkout could not be opened: ${opened.error}`);

                    // The Razorpay modal is an iframe on api.razorpay.com.
                    await tab.waitForSelector('iframe.razorpay-checkout-frame', {
                        state: 'attached',
                        timeout: config.runtime.stepTimeoutMs,
                    });
                }

                return tab;
            });

            await recorder.step('Checkout shows payment options', async () => {
                // Give the hosted page / modal a moment to paint its method
                // list, then assert something payment-shaped is on screen.
                await checkoutPage.waitForTimeout(4000);

                const frames = checkoutPage.frames();
                let text = '';
                for (const frame of frames) {
                    text += ' ' + ((await frame.textContent('body').catch(() => '')) || '');
                }

                const looksLikeCheckout =
                    /upi|card|net ?banking|wallet|pay now|payment method|paytm|phonepe/i.test(text);

                expect(
                    looksLikeCheckout,
                    'The gateway page loaded but no payment methods rendered — ' +
                    `students would see an empty checkout. Page: ${checkoutPage.url()}`
                );

                // A gateway error page is a load "success" as far as HTTP is
                // concerned, so it has to be excluded explicitly.
                expect(
                    !/order (not found|expired)|invalid (order|session)|something went wrong/i.test(text),
                    `The gateway rejected the order: ${text.replace(/\s+/g, ' ').slice(0, 300)}`
                );

                return 'payment methods visible';
            });

            // ── Optional: actually pay ──────────────────────────────────────
            // Sandbox only — see utils/payCard.js for why a real production
            // card payment cannot be completed unattended in India.
            if (config.payment.complete) {
                await recorder.step('Complete the payment', async () => {
                    const outcome = await payWithCard(checkoutPage, config.payment.card, { log });
                    recorder.note('otpEntered', outcome.otpEntered);
                    return outcome.otpEntered ? 'card + OTP submitted' : 'card submitted';
                });

                await recorder.step('Payment callback returns to the site', async () => {
                    // The gateway redirects to return_url once the payment
                    // settles. Reaching it proves checkout → payment →
                    // callback works; the order assertion below then proves
                    // the callback was actually processed.
                    await checkoutPage.waitForURL(
                        (url) => url.href.includes('payment-status') || url.href.includes(config.targets.dashboard),
                        { timeout: config.payment.confirmTimeoutMs }
                    );

                    const text = (await checkoutPage.textContent('body').catch(() => '')) || '';
                    expect(
                        !/failed|unsuccessful|declined/i.test(text),
                        `Returned to the site but the payment was not successful: ` +
                        `${text.replace(/\s+/g, ' ').slice(0, 300)}`
                    );
                    return checkoutPage.url();
                });

                await recorder.step('Order marked paid', async () => {
                    const orderId = order.original_order_id || order.order_id;
                    expect(orderId, 'No order id to verify.');

                    let paid = false;
                    let last = '';

                    // The webhook can land a moment after the browser redirect.
                    for (let attempt = 0; attempt < 5 && !paid; attempt += 1) {
                        if (attempt > 0) await new Promise((r) => setTimeout(r, 3000));

                        const result = await page.evaluate(
                            async ({ base, body }) => {
                                const res = await fetch(`${base}/get-payment-details`, {
                                    method: 'POST',
                                    credentials: 'include',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(body),
                                });
                                return { status: res.status, text: (await res.text()).slice(0, 600) };
                            },
                            {
                                base: config.targets.paymentApi,
                                body: { order_id: orderId, user_id: Number(shared.userId) },
                            }
                        );

                        last = result.text;
                        if (result.status < 400 && /paid|success|captured/i.test(result.text)) paid = true;
                    }

                    expect(
                        paid,
                        'The payment completed at the gateway but the order was never marked paid — ' +
                        `the callback or webhook is not being processed. Last response: ${last}`
                    );
                    recorder.note('paymentCompleted', true);
                    return 'order confirmed paid';
                });

                log.info(`payment COMPLETED for user ${shared.userId} — ${config.payment.amount} charged`);
                return;
            }

            // ── Order persisted on our side ─────────────────────────────────
            await recorder.softStep('Order recorded in payment DB', async () => {
                const orderId = order.original_order_id || order.order_id;
                if (!orderId) return 'no order id to look up';

                const result = await page.evaluate(
                    async ({ base, body }) => {
                        const res = await fetch(`${base}/get-payment-details`, {
                            method: 'POST',
                            credentials: 'include',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(body),
                        });
                        return { status: res.status, text: (await res.text()).slice(0, 400) };
                    },
                    {
                        base: config.targets.paymentApi,
                        body: { order_id: orderId, user_id: Number(shared.userId) },
                    }
                );

                expect(
                    result.status < 500,
                    `get-payment-details returned HTTP ${result.status} — ${result.text}`
                );
                return `HTTP ${result.status}`;
            });

            log.info(
                `payment checkout verified via ${order.gateway} for user ${shared.userId} — order abandoned, nothing charged`
            );
            recorder.note('paymentCompleted', false);
        } catch (error) {
            for (const artifact of await capturePage(
                checkoutPage || page,
                artifactDir,
                'payment-checkout',
                { consoleLines }
            )) {
                recorder.addArtifact(artifact);
            }
            throw error;
        } finally {
            // Abandoning the checkout is the point — never leave a tab that
            // could complete a payment.
            await closeQuietly(checkoutPage);
        }
    },
};
