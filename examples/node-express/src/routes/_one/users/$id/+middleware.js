export default function ({ params }) {
  if (parseInt(params.id, 10) % 2) {
    throw new Error("An error thrown by middleware");
  }
  // Note: implicit next call
}
