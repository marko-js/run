// Neither validator runs before the handler throws, so both first run for the error page.
export const GET = Run.GET(
  {
    params() {
      throw new Error("Thrown in params validator");
    },
    search() {
      throw new Error("Thrown in search validator");
    },
  },
  () => {
    throw new Error("Thrown in handler");
  },
);
