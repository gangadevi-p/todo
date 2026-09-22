// Nudge is an unsigned personal app: skip Windows code signing entirely.
// Replace this hook (win.signtoolOptions.sign) if you ever add a certificate.
exports.default = async function noSign() {};
