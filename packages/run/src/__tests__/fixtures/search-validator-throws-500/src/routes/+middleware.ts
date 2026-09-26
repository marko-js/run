let calls = 0;

// The page never reads `search`; the count shows the validator ran once.
export default Run.ALL({
  search() {
    throw new Error(`Thrown in search validator (call ${++calls})`);
  },
});
