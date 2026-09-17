// src/utils/phoneInput.js
//
// react-phone-input-2 is a controlled, masked input that pre-fills the dial
// code for the default country and re-inserts it as you edit. Ctrl+A followed
// by typing does NOT give you a clean field: the component keeps "+91 ", the
// typed digits land after it, and the mask silently truncates the overflow —
// producing a valid-looking but completely different phone number.
//
// So: clear it digit by digit, type the full international number, then read
// the value back and assert it. A silent mismatch here would register the
// synthetic student under the wrong number, which is the kind of bug a monitor
// must never have.

const digitsOf = (value) => String(value || '').replace(/\D/g, '');

export async function fillPhoneInput(page, selector, { countryCode, phone, timeout = 15000 }) {
    const input = page.locator(selector).first();
    await input.waitFor({ state: 'visible', timeout });

    const wanted = `${countryCode}${phone}`;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
        await input.click();

        // Backspace past whatever the mask left behind. The loop is bounded by
        // the field emptying, not by a fixed count.
        for (let i = 0; i < 24; i += 1) {
            const current = digitsOf(await input.inputValue());
            if (current.length === 0) break;
            await input.press('Backspace');
        }

        await input.pressSequentially(wanted, { delay: 30 });

        const got = digitsOf(await input.inputValue());
        if (got === wanted) return got;

        if (attempt === 2) {
            throw new Error(
                `Phone field did not accept the number: wanted "${wanted}", field holds "${got}". ` +
                'The phone input component or its country default has changed.'
            );
        }
    }

    return wanted;
}

export default fillPhoneInput;
