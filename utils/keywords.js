const SPLIT = /[^\p{L}\p{N}+#.-]+/u; 
const splitTokens = s =>
  typeof s === "string" ? s.split(SPLIT).map(t => t.trim().toLowerCase()).filter(Boolean) : [];

const toArray = v => (Array.isArray(v) ? v : v ? [v] : []);

const STOPWORDS = new Set([

  "a","an","and","the","in","on","at","for","to","of","is","are","was","were","by","with","or","as","it","be","but","not","this","that","which","who","whom","its","their","they","he","she","we","you","me","him","her","us","them","got"
  ,"my","your","his","her","our","their","there","where","when","why","how","what","who","whom","whose","if","then","than","so","such","more","most","less","least","all","some","any","no","none",
  "each","every","either","neither","both","few","many","much","into","out","up","down","over","under","after","before","during","while","since","until","about","around","through","across","along",

  "من","في","على","الى","إلى","عن","مع","هذا","هذه","ذلك","تلك","هو","هي","هم","هن","أن","إن","لكن","بل","ثم","قد","كل","أي","أيضا","او","أو","ما","لم","لن","لا","ليس","كان","كانت","يكون","يكونون","يكونون","يكونون","يكونون",
  
]);

const generateKeywords = (title, description, provided, linkMeta, extractedImage) => {
  const titleTokens       = splitTokens(title);
  const descriptionTokens = splitTokens(description);
  const imageTokens       = splitTokens(extractedImage);

  const providedTokens = toArray(provided).flatMap(splitTokens);

  const linkTokens = linkMeta
    ? [
        ...splitTokens(linkMeta.title),
        ...splitTokens(linkMeta.description),
        ...toArray(linkMeta.keywords).flatMap(splitTokens),
        ...splitTokens(linkMeta.author),
        ...splitTokens(linkMeta.url),
        ...splitTokens(linkMeta.image),
      ]
    : [];

  const all = [...new Set([...titleTokens, ...descriptionTokens,...imageTokens, ...providedTokens, ...linkTokens])]
    .filter(w => w.length >1 &&! STOPWORDS.has(w)); 

  return all;
};

module.exports = { generateKeywords };
