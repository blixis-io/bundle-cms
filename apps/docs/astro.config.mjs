import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
  integrations: [starlight({
    title: "Blixis CMS",
    description: "Build content APIs with Blixis CMS.",
    sidebar: [
      { label: "Start", items: [{ autogenerate: { directory: "start" } }] },
      { label: "Architecture", items: [{ autogenerate: { directory: "architecture" } }] }
    ]
  })]
});
