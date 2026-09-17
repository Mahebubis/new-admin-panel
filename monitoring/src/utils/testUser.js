// src/utils/testUser.js
//
// The single fixed test account used by every journey run.
//
// It is fixed rather than generated because a new account per run would pile
// up thousands of rows in `users` and skew every signup and exam statistic.
// The trade-off is that the account has to be deleted before each run so the
// same email can register again — see src/db.js.
//
// The validation here mirrors the application's own rules. Getting any of them
// wrong produces a check that fails forever for a reason that has nothing to
// do with production being broken, so it is caught up front instead.

import config from '../config.js';

// The register form's client-side check, copied from RegisterPage.jsx.
const APP_EMAIL_RE = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;

export function getTestStudent(overrides = {}) {
    const { student } = config;

    if (!APP_EMAIL_RE.test(student.email)) {
        throw new Error(
            `MONITOR_EMAIL "${student.email}" is rejected by the registration form's own email ` +
            'validation. Letters, digits, underscore, dot and hyphen only — no "+" addressing.'
        );
    }
    if (!/^[6-9]\d{9}$/.test(student.phone)) {
        throw new Error(
            `MONITOR_PHONE "${student.phone}" must be exactly 10 digits starting with 6-9.`
        );
    }
    // register2.php: "First name and last name should not contain special
    // characters" — and digits count as special.
    for (const [label, value] of [['MONITOR_FIRST_NAME', student.firstName], ['MONITOR_LAST_NAME', student.lastName]]) {
        if (!/^[A-Za-z]+$/.test(value)) {
            throw new Error(`${label} "${value}" must be letters only.`);
        }
    }

    return {
        email: student.email,
        password: student.password,
        firstName: student.firstName,
        lastName: student.lastName,
        phone: student.phone,
        countryCode: student.countryCode,
        country: 'in',
        ...overrides,
    };
}

export default getTestStudent;
