declare module "virtual:marko-run-adapter-netlify/routes" {
  /** The app's routes as a Netlify edge function declaration. */
  const declaration: {
    path: `/${string}`[];
    excludedPath: `/${string}`[];
  };
  export default declaration;
}
