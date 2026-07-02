export default Run.POST((_ctx, next) => {
  return next({
    foo: 1
  })
})
