// The classic copy-paste rename: the export says GET, the factory says POST.
export const GET = Run.POST(() => new Response("posted"));
