// utils/keywords.js
const AR_STOP = new Set([
  "و","في","من","على","عن","إلى","الى","مع","أن","إن","كان","كانت","هو","هي","هم","هذا","هذه","ذلك","تلك","هناك","كل","كما","أو","او","بل","إذا","اذا","حتى","ثم","قد","لقد","ما","لم","لن","لا","أي","اي","أنا","انت","انتِ","أنتم","انتم","أننا","اننا","نحن","هو","هي","هما","لدي","لديه","عند","عنده","اليوم","بس","ده","دي"
]);

const EN_STOP = new Set([
  "the","a","an","and","or","but","of","to","in","on","for","with","by","from","as","at","is","are","was","were","be","been","being","it","its","this","that","these","those","you","your","i","we","they","he","she","them","our","us","my","me","do","does","did","not","no","yes","just","only","very","more","most","less","least","up","down","out","over","under","into","about"
]);

const stripDiacriticsArabic = (s="") =>
  s.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, "");

const norm = (s="") =>
  stripDiacriticsArabic(s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s#\-]/gu, " ")   // keep letters/numbers/hashtags/hyphens
    .replace(/\s+/g, " ")
    .trim();

const isArabic = (s="") => /[\u0600-\u06FF]/.test(s);

const tokenize = (s="") =>
  norm(s)
    .split(" ")
    .filter(Boolean);

const isStop = (token) => {
  const t = token.replace(/^#/, ""); // treat hashtags as tokens but test without '#'
  const list = isArabic(t) ? AR_STOP : EN_STOP;
  return list.has(t);
};

const ngrams = (tokens, n=2) => {
  const out = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    out.push(tokens.slice(i, i+n).join(" "));
  }
  return out;
};

const uniquePush = (arr, val) => {
  if (!val) return;
  if (!arr.includes(val)) arr.push(val);
};

function scoreTerms({title, description, boards=[], fileName="", hashtags=[]}) {
  const titleTokens = tokenize(title || "");
  const descTokens  = tokenize(description || "");
  const boardTokens = tokenize((boards || []).join(" "));
  const fileTokens  = tokenize((fileName || "").replace(/\.[a-z0-9]+$/i,""));
  const hashTokens  = (hashtags || []).map(h => norm(h)).filter(Boolean);

  // Filter stopwords + tiny tokens
  const clean = (arr) => arr.filter(t => t.length > 1 && !isStop(t));

  const tClean = clean(titleTokens);
  const dClean = clean(descTokens);
  const bClean = clean(boardTokens);
  const fClean = clean(fileTokens);
  const hClean = clean(hashTokens);

  // Generate n-grams (prefer from title/description)
  const t2 = ngrams(tClean, 2), t3 = ngrams(tClean, 3);
  const d2 = ngrams(dClean, 2), d3 = ngrams(dClean, 3);

  // Base frequency map
  const scores = new Map();

  const bump = (term, w) => {
    if (!term) return;
    const prev = scores.get(term) || 0;
    scores.set(term, prev + w);
  };

  // Weighting rules (tweak as you like)
  // singles
  tClean.forEach((tok, i) => bump(tok, 4 + Math.max(0, 3 - i))); // title boost + early tokens
  dClean.forEach((tok, i) => bump(tok, 2 + Math.max(0, 2 - i)));
  bClean.forEach(tok => bump(tok, 2)); // board context
  fClean.forEach(tok => bump(tok, 1)); // filename weak
  hClean.forEach(tok => bump(tok.startsWith("#") ? tok : `#${tok}`, 3)); // keep hashtags

  // phrases
  t2.forEach((p, i) => bump(p, 6 + Math.max(0, 2 - i)));
  t3.forEach((p, i) => bump(p, 7 + Math.max(0, 1 - i)));
  d2.forEach((p, i) => bump(p, 3 + Math.max(0, 1 - i)));
  d3.forEach((p)    => bump(p, 4));

  // Slight preference for tokens that appear in both title & description
  const setT = new Set(tClean), setD = new Set(dClean);
  setT.forEach(tok => { if (setD.has(tok)) bump(tok, 2); });

  return scores;
}

function rankAndClamp(scores, {max=16}) {
  // prefer phrases (contain a space) over singles at same score
  const entries = [...scores.entries()].sort((a,b) => {
    const [ka, va] = a, [kb, vb] = b;
    if (vb !== va) return vb - va;
    const aPhrase = ka.includes(" "), bPhrase = kb.includes(" ");
    if (aPhrase !== bPhrase) return aPhrase ? -1 : 1; // phrase first
    return ka.localeCompare(kb);
  });

  // De-duplicate stems-ish: drop single tokens fully contained in a higher-ranked phrase
  const picked = [];
  const seenSingles = new Set();
  for (const [term] of entries) {
    // avoid overly generic leftover singles if a phrase contains them
    const blocked = term.includes(" ") ? false : picked.some(p => p.includes(term));
    if (blocked) continue;
    if (!picked.includes(term)) picked.push(term);
    if (term.indexOf(" ") < 0) seenSingles.add(term);
    if (picked.length >= max) break;
  }
  return picked;
}

function setKeywordsSmart({ title, description, boards = [], fileName = "", hashtags = [] }, opts = {}) {
  if (!title && !description && !boards.length && !fileName && !hashtags.length) return [];
  const scores = scoreTerms({ title, description, boards, fileName, hashtags });
  return rankAndClamp(scores, { max: opts.max || 16 });
}

module.exports = { setKeywordsSmart };