// AUTO-EXTRACTED verbatim from scripts/storage.js (pre-#337 behavior). DO NOT EDIT BY HAND.
// Regenerate with extract_original.js. Preserves the literal U+2005 byte in the space filter.
function _baekjoonRankRemoverFilter(path) {
  return path.replace(/\/(Unrated|Silver|Bronze|Gold|Platinum|Diamond|Ruby|Master)\//g, '/');
}

function _programmersRankRemoverFilter(path) {
  return path.replace(/\/((?:lv)?[0-9]|unrated)\//g, '/');
}

function _baekjoonSpaceRemoverFilter(path) {
  return path.replace(/( | |&nbsp|&#160|&#8197|%E2%80%85|%20)/g, '');
}

function _swexpertacademyRankRemoveFilter(path) {
  return path.replace(/\/D([0-8]+)\//g, '/');
}

// Chain order identical to storage.js updateObjectDatafromPath/getObjectDatafromPath
function originalNormalize(path) {
  return _swexpertacademyRankRemoveFilter(_baekjoonSpaceRemoverFilter(_programmersRankRemoverFilter(_baekjoonRankRemoverFilter(path))));
}

module.exports = {
  originalNormalize,
  _baekjoonRankRemoverFilter,
  _programmersRankRemoverFilter,
  _baekjoonSpaceRemoverFilter,
  _swexpertacademyRankRemoveFilter,
};
