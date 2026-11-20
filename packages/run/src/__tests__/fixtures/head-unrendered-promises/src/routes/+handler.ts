export const GET = Run.GET({}, (_ctx, next) => {
  return next({ reviews: loadReviews() });
});

function loadReviews() {
  return new Promise<string>((_resolve, reject) => {
    setTimeout(() => reject(new Error("reviews unavailable")), 10);
  });
}
