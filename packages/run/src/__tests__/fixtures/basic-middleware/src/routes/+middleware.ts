const middleware: MarkoRun.Handler = (context) => {
  context.data = 'Data from middleware'
}

export default middleware;