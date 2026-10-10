function toPaise(value) {
  const text = String(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
    throw new Error("Invalid money amount");
  }
  const [whole, fraction = ""] = text.split(".");
  return Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
}

function fromPaise(paise) {
  if (!Number.isSafeInteger(paise) || paise < 0) {
    throw new Error("Invalid money amount");
  }
  return `${Math.floor(paise / 100)}.${String(paise % 100).padStart(2, "0")}`;
}

module.exports = { toPaise, fromPaise };
