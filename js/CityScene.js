class CityScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CityScene' });
    }

    create() {
        const W = this.scale.width;
        const H = this.scale.height;

        // 1. 顶部金币
        this.coinText = this.add.text(30, 30, `💰 金币: ${Math.floor(DataManager.data.coins)}`, { fontSize: '32px', color: '#fff' });

        // 2. 狩猎入口 (右侧)
        this.add.text(W - 200, 50, ' 去狩猎 >> ', { 
            fontSize: '32px', backgroundColor: '#f00', padding: { x: 20, y: 15 } 
        })
        .setOrigin(0.5).setInteractive()
        .on('pointerdown', () => this.scene.start('ShooterScene'));

        // 3. 城市配置
        this.cityConfig = [
            { name: '村庄', cost: 500,   earnRange: [1, 2],   loseRange: [1, 2] },
            { name: '县城', cost: 2000,  earnRange: [5, 10],  loseRange: [3, 5] },
            { name: '都城', cost: 10000, earnRange: [20, 50], loseRange: [10, 20] }
        ];

        // 容器用于存放动态更新的文本对象
        this.cityUIObjects = [];

        // 渲染 3 个城市
        const spacing = W / 4; 
        this.cityConfig.forEach((cfg, index) => {
            let x = spacing * (index + 1);
            let y = H / 2;
            this.createCityCard(x, y, index, cfg);
        });
    }

    // 每帧更新倒计时
    update() {
        const now = Date.now();
        
        this.cityUIObjects.forEach((ui, index) => {
            const cooldownEnd = DataManager.data.cityCooldowns[index];
            const isUnlocked = DataManager.data.unlockedCities[index];

            if (!isUnlocked) return; // 未解锁不用更新倒计时

            if (cooldownEnd > now) {
                // 倒计时中
                let remaining = cooldownEnd - now;
                ui.statusText.setText(this.formatTime(remaining));
                ui.statusText.setColor('#aaaaaa'); // 灰色
                ui.actionBtn.setVisible(false); // 隐藏打工按钮
                ui.adBtn.setVisible(true); // 显示加速按钮
            } else {
                // 冷却结束，可以打工
                ui.statusText.setText('空闲中');
                ui.statusText.setColor('#00ff00'); // 绿色
                ui.actionBtn.setVisible(true); // 显示打工按钮
                ui.actionBtn.text = '开始打工';
                ui.adBtn.setVisible(false); // 隐藏加速按钮
            }
        });
    }

    createCityCard(x, y, index, cfg) {
        // 背景框
        this.add.rectangle(x, y, 220, 300, 0x333333).setStrokeStyle(2, 0xffffff);
        
        // 城市名
        this.add.text(x, y - 120, cfg.name, { fontSize: '32px', fontStyle: 'bold', color: '#fff' }).setOrigin(0.5);

        // 状态文本 (显示倒计时 或 锁)
        let statusText = this.add.text(x, y - 50, '', { fontSize: '24px', color: '#fff' }).setOrigin(0.5);

        // 核心按钮 (解锁 / 打工)
        let actionBtn = this.add.text(x, y + 50, '', { 
            fontSize: '24px', backgroundColor: '#555', padding: { x: 10, y: 10 } 
        }).setOrigin(0.5).setInteractive();

        // 加速按钮 (默认隐藏)
        let adBtn = this.add.text(x, y + 110, '📺加速50%', { 
            fontSize: '20px', backgroundColor: '#aa0000', padding: { x: 5, y: 5 } 
        }).setOrigin(0.5).setInteractive().setVisible(false);

        // 保存引用以便 update 更新
        this.cityUIObjects[index] = { statusText, actionBtn, adBtn };

        // 初始化显示状态
        this.refreshCardState(index, cfg, statusText, actionBtn);

        // --- 事件绑定 ---

        // 主按钮点击
        actionBtn.on('pointerdown', () => {
            if (!DataManager.data.unlockedCities[index]) {
                // 尝试解锁
                this.tryUnlock(index, cfg.cost);
            } else {
                // 尝试打工
                this.startWork(index, cfg);
            }
        });

        // 加速按钮点击
        adBtn.on('pointerdown', () => {
            this.watchAdToSpeedUp(index);
        });
    }

    refreshCardState(index, cfg, statusText, actionBtn) {
        const isUnlocked = DataManager.data.unlockedCities[index];

        if (!isUnlocked) {
            statusText.setText('未解锁');
            statusText.setColor('#ff0000');
            actionBtn.setText(`购买 🔒${cfg.cost}`);
            actionBtn.setStyle({ backgroundColor: '#555' });
        } else {
            // 已解锁状态由 update() 函数接管动态刷新
        }
    }

    // 解锁逻辑
    tryUnlock(index, cost) {
        if (DataManager.data.coins >= cost) {
            if (confirm(`花费 ${cost} 金币购买【${this.cityConfig[index].name}】？`)) {
                DataManager.data.coins -= cost;
                DataManager.data.unlockedCities[index] = true;
                DataManager.save();
                
                // 刷新界面
                this.coinText.setText(`💰 金币: ${Math.floor(DataManager.data.coins)}`);
                this.scene.restart(); 
            }
        } else {
            alert('金币不足！请去射击游戏赚钱！');
        }
    }

    // 打工逻辑 (核心概率)
    startWork(index, cfg) {
        // 概率计算
        let rand = Math.random(); // 0.0 ~ 1.0
        let resultType = ''; // win, draw, lose
        let amount = 0;

        if (rand < 0.2) { 
            // 20% 亏钱
            resultType = 'lose';
            amount = Phaser.Math.Between(cfg.loseRange[0], cfg.loseRange[1]);
        } else if (rand < 0.5) { 
            // 30% (0.2 ~ 0.5) 没赚没亏
            resultType = 'draw';
            amount = 0;
        } else {
            // 50% 赚钱
            resultType = 'win';
            amount = Phaser.Math.Between(cfg.earnRange[0], cfg.earnRange[1]);
        }

        // 结算资金
        if (resultType === 'win') {
            DataManager.data.coins += amount;
            alert(`【打工周报】\n运气不错！赚到了 ${amount} 金币。`);
        } else if (resultType === 'lose') {
            DataManager.data.coins = Math.max(0, DataManager.data.coins - amount);
            alert(`【打工周报】\n倒霉！工作中打碎了东西，赔偿 ${amount} 金币。`);
        } else {
            alert(`【打工周报】\n白忙活一场，老板没发工资（0收益）。`);
        }

        // 设置 12 小时冷却
        // 12小时 = 12 * 60 * 60 * 1000 毫秒
        const cooldownMs = 12 * 60 * 60 * 1000; 
        DataManager.data.cityCooldowns[index] = Date.now() + cooldownMs;
        
        DataManager.addHistory('work', resultType === 'lose' ? -amount : amount, `在${cfg.name}打工`);
        DataManager.save();

        this.coinText.setText(`💰 金币: ${Math.floor(DataManager.data.coins)}`);
    }

    // 广告加速逻辑
    watchAdToSpeedUp(index) {
        let remaining = DataManager.data.cityCooldowns[index] - Date.now();
        if (remaining <= 0) return;

        // 模拟看广告
        let allow = confirm('观看广告将缩短 50% 的等待时间，是否观看？');
        if (allow) {
            // 减少一半时间
            let newRemaining = Math.floor(remaining / 2);
            DataManager.data.cityCooldowns[index] = Date.now() + newRemaining;
            DataManager.save();
            alert('加速成功！');
        }
    }

    // 格式化毫秒为 HH:MM:SS
    formatTime(ms) {
        let s = Math.floor(ms / 1000);
        let h = Math.floor(s / 3600);
        s %= 3600;
        let m = Math.floor(s / 60);
        s %= 60;
        return `${this.pad(h)}:${this.pad(m)}:${this.pad(s)}`;
    }

    pad(n) {
        return n < 10 ? '0' + n : n;
    }
}