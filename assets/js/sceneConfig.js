export function shouldUseEzTree(search = "") {
  return new URLSearchParams(search).get("skeleton") !== "legacy";
}
