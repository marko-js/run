export const GET = Run.GET({
  params(value) {
    return {
      id: Number(value.id)
    }
  }
}, () => {
  
})