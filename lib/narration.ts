export function cleanNarrationForVoice(narration: string) {
  return narration
    .replace(/```[\s\S]*?```/g, " ")
    .replace(
      /\[(?:pause|beat|silence|music|sfx|sound|transition)[^\]]*\]/gi,
      "\n",
    )
    .split(/\r?\n|(?=\b(?:scene|beat|shot)\s*\d+\s*[:.-])/gi)
    .map((line) =>
      line
        .replace(/^\s*(?:scene|beat|shot)\s*\d+\s*[:.)-]?\s*/i, "")
        .replace(/^\s*(?:frame|photo)\s*\d+\s*[:.)-]?\s*/i, "")
        .replace(/\b(?:scene|beat|shot)\s*\d+\s*[:.)-]\s*/gi, "")
        .replace(
          /\b(?:start|end|time|timestamp|duration)\s*[:=]\s*\d{1,2}:\d{2}(?::\d{2})?\b/gi,
          "",
        )
        .replace(
          /\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:-|--|\u2014|\u2013|to|\u2192|->)\s*\d{1,2}:\d{2}(?::\d{2})?\b/gi,
          "",
        )
        .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b\s*(?:-|--|\u2014|\u2013|:)?\s*/g, "")
        .replace(/^\s*(?:-|--|\u2014|\u2013|:)\s*/, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .join("\n");
}
