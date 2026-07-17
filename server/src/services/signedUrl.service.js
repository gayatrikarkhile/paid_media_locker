const jwt = require('jsonwebtoken');
const { fileTokenSecret, fileTokenTtlSeconds } = require('../config/env');

// These tokens are deliberately separate from the login JWT:
//  - much shorter lifetime (default 60s)
//  - scoped to exactly one (user, media, variant) triple
//  - can't be used for anything except fetching that one file
// This is what makes "copy this URL and send it to a friend" useless
// after ~a minute, and useless for any other media item even before that.
function issueFileToken({ userId, mediaId, variant }) {
  return jwt.sign({ uid: userId, mid: mediaId, variant }, fileTokenSecret, {
    expiresIn: fileTokenTtlSeconds,
  });
}

function verifyFileToken(token) {
  return jwt.verify(token, fileTokenSecret); // throws on bad/expired token
}

module.exports = { issueFileToken, verifyFileToken };
