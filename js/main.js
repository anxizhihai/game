const config = {
    type: Phaser.AUTO,
    // 1. 设定适配移动端的高清分辨率 (16:9)
    scale: {
        mode: Phaser.Scale.FIT,              // 自动缩放模式：适应屏幕
        autoCenter: Phaser.Scale.CENTER_BOTH, // 自动居中
        width: 1280,                         // 逻辑宽度
        height: 720,                         // 逻辑高度
        orientation: Phaser.Scale.Orientation.LANDSCAPE // 建议强制横屏 (部分浏览器支持)
    },
    // backgroundColor: '#2d2d2d',
    transparent: true, 
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: true // 手机上建议关闭 debug 提升性能
        }
    },
    scene: [CityScene, ShooterScene]
};

const game = new Phaser.Game(config);