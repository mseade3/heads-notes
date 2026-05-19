export const htmlToPlainText = (html: string) =>
  html
    .replaceAll(/<style[\s\S]*?<\/style>/gi, "")
    .replaceAll(/<script[\s\S]*?<\/script>/gi, "")
    .replaceAll(/<(br|\/p|\/div|\/li|h[1-6])>/gi, "\n")
    .replaceAll(/<[^>]+>/g, "")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll(/\n\s+\n/g, "\n")
    .replaceAll(/[ \t]+/g, " ")
    .trim();
