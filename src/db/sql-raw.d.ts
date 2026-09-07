// Fichier de déclaration pour les imports SQL bruts (`?raw`) utilisés
// par l'adaptateur Android. En Electron, le schéma est lu par le process main.
/// <reference types="vite/client" />

declare module '*?raw' {
  const content: string
  export default content
}