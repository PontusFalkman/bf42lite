import { ClientGame } from './ClientGame';

// Prevent context menu
document.addEventListener('contextmenu', event => event.preventDefault());

console.log("Starting bf42lite Client...");
const game = new ClientGame();
game.start();