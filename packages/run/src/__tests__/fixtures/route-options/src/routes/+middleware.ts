export default Run.ALL({
  search(value) {
    if ('q' in value) {
      return {
        ...value,
        q: Number(value.q)
      }
    }
    return value;
  }
})