export const GET = Run.GET((_ctx, next) => {
  return next({
    value: "GET"
  })
})

export const POST = Run.POST((_ctx, next) => {
  return next({
    value: "POST"
  })
})
