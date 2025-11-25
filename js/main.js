// 获取当前窗口的宽高比
const windowWidth = window.innerWidth;
const windowHeight = window.innerHeight;
const ratio = windowHeight / windowWidth;

// 设定固定的逻辑宽度
const gameWidth = 1280;
// 根据屏幕比例，动态计算需要的高度，确保占满垂直屏幕
const gameHeight = Math.ceil(gameWidth * ratio);

const config = {
    type: Phaser.AUTO,
    scale: {
        // 依然使用 FIT 模式，保证内容不被裁切
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        
        // 【核心修改】
        // 宽度固定 1280，保护你的横向布局
        width: gameWidth, 
        // 高度动态计算，确保 FIT 模式下正好撑满上下，没有黑边
        height: gameHeight, 
        
        orientation: Phaser.Scale.Orientation.LANDSCAPE
    },
    // 背景全黑
    backgroundColor: '#000000', 
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false 
        }
    },
    scene: [CityScene, ShooterScene]
};

const game = new Phaser.Game(config);