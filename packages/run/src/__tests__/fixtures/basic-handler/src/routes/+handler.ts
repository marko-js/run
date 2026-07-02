export const GET: MarkoRun.Handler = (context, next) => {
  return next({
    value: 'Data from handler'
  })
}