
class ShooterScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ShooterScene' });
    }

    preload() {
        // 在此加载图片素材
        // this.load.image('bomb', 'assets/bomb.png'); 
    }

    create() {
        this.cameras.main.setBackgroundColor('#4488aa'); 
        const W = this.scale.width;
        const H = this.scale.height;

        this.currentWeapon = 'bow';
        this.isSpawning = false;
        
        // 物理组
        this.bullets = this.physics.add.group(); 
        this.targets = this.physics.add.group();

        this.physics.world.setBounds(0, 0, W, H);
        this.createUI(W, H);

        // 点击射击
        this.input.on('pointerdown', (pointer) => this.fireWeapon(pointer, H), this);
    }

    createUI(W, H) {
        // --- 1. 初始化容器 (保持不变) ---
        this.switchBtns = {}; 

        // --- 2. 顶部黑色背景条 (保持不变) ---
        this.add.rectangle(W / 2, 50, W, 100, 0x000000).setAlpha(0.8).setDepth(10);
        
        // --- 3. 回城按钮 (保持不变) ---
        this.createBtn(80, 50, ' < 回城 ', '#555', () => this.scene.start('CityScene'));

        // --- 4. 信息文字 (金币/弹药显示) ---
        // 位置稍微调整一下，给新按钮腾位置
        this.infoText = this.add.text(150, 20, '', { fontSize: '20px', color: '#fff' }).setDepth(11);

        // === 【新增】常驻的加金币按钮 ===
        // 放在顶部，稍微靠右一点的位置
        this.addCoinBtn = this.add.text(350, 30, ' 📺免费金币 ', { 
            fontSize: '20px', 
            backgroundColor: '#aa0000', // 红色醒目一点
            padding: { x: 10, y: 5 },
            color: '#fff',
            fontStyle: 'bold'
        })
        .setOrigin(0, 0) // 左上角对齐
        .setDepth(11)
        .setInteractive()
        .on('pointerdown', () => this.watchAd()); // 点击触发看广告

        // --- 5. 商店与切换按钮 (保持不变) ---
        let startX = W - 350; 
        this.createShopItem(startX, 20, 'bow', 10, 10, '买弓');
        this.createShopItem(startX + 110, 20, 'gun', 10, 5, '买枪');
        this.createShopItem(startX + 220, 20, 'shoe', 10, 3, '买鞋');

        this.createSwitchBtn(startX, 70, 'bow', '装备:弓');
        this.createSwitchBtn(startX + 110, 70, 'gun', '装备:枪');
        this.createSwitchBtn(startX + 220, 70, 'shoe', '装备:鞋');

        // --- 6. 底部召唤按钮 (保持不变) ---
        this.spawnBtn = this.add.text(W / 2, H - 80, ' 召唤猎物 (-10金币) ', { 
            fontSize: '36px', backgroundColor: '#00aa00', padding: { x: 30, y: 20 }, fontStyle: 'bold'
        })
        .setOrigin(0.5).setInteractive().setDepth(10)
        .on('pointerdown', () => this.startWave());

        // === 【删除】原来的 this.adBtn 相关代码全部删掉 ===
        // (把原来 W/2, H/2 那个红色大按钮删掉)

        this.updateUI();
    }

    // ... (保持 createBtn, createShopItem, createSwitchBtn 不变) ...
    createBtn(x, y, text, color, callback) {
        return this.add.text(x, y, text, { fontSize: '24px', backgroundColor: color, padding: { x: 15, y: 10 } })
            .setOrigin(0.5).setDepth(11).setInteractive().on('pointerdown', callback);
    }

    createShopItem(x, y, weaponKey, cost, amount, label) {
        this.add.text(x, y, `${label}\n$${cost}`, { 
            fontSize: '18px', backgroundColor: '#333', align: 'center', padding: { x: 10, y: 5 }
        }).setDepth(11).setInteractive().on('pointerdown', () => {
            if (DataManager.spendCoins(cost)) {
                DataManager.data.ammo[weaponKey] += amount;
                DataManager.save();
                this.updateUI();
                this.showToast(`${label} 成功`);
            } else {
                this.showToast("金币不足");
                this.checkBalance();
            }
        });
    }

    updateSwitchButtons() {
        // 防止报错：如果按钮还没创建好，就直接退出
        if (!this.switchBtns) return;

        // 遍历三个武器代号
        ['bow', 'gun', 'shoe'].forEach(key => {
            let btn = this.switchBtns[key]; // 拿出对应的按钮对象
            if (btn) {
                if (key === this.currentWeapon) {
                    // 如果是当前武器 -> 变绿，稍微变大
                    btn.setBackgroundColor('#00aa00');
                    btn.setScale(1.1);
                } else {
                    // 如果不是 -> 变灰，恢复大小
                    btn.setBackgroundColor('#555');
                    btn.setScale(1.0);
                }
            }
        });
    }

    createSwitchBtn(x, y, weaponKey, label) {
        // 1. 创建文字按钮
        let btn = this.add.text(x, y, label, { 
            fontSize: '18px', 
            backgroundColor: '#555', // 默认灰色
            padding: { x: 10, y: 5 } 
        })
        .setDepth(11)
        .setInteractive();

        // 2. 添加点击事件
        btn.on('pointerdown', () => {
            this.currentWeapon = weaponKey; // 改变当前武器
            this.updateUI(); // 刷新界面(这会触发颜色的更新)
            console.log("切换武器为:", weaponKey); // 方便调试
        });

        // 3. 【关键】把按钮存进 switchBtns 对象里，名字就是 weaponKey
        // 这样我们以后就可以通过 this.switchBtns['gun'] 找到枪的按钮
        this.switchBtns[weaponKey] = btn;
    }

    // --- 替换原有的 updateUI 方法 ---
    updateUI() {
        const d = DataManager.data;
        
        // 1. 获取当前武器名称
        const currentName = this.getWeaponName(this.currentWeapon);
        
        // 2. 显示更详细的信息：金币 + 当前装备 + 所有库存
        this.infoText.setText(
            `💰 金币: ${d.coins}\n` +
            `✋ 当前装备: [ ${currentName} ]\n` + 
            `----------------\n` +
            `📦 库存:\n` +
            `   🏹 弓箭: ${d.ammo.bow}\n` +
            `   🔫 枪弹: ${d.ammo.gun}\n` +
            `   👟 飞鞋: ${d.ammo.shoe}`
        );

        // 刷新商店按钮的状态（可选）
        this.checkBalance();
        
        // 更新切换按钮的颜色（视觉反馈）
        this.updateSwitchButtons();
    }

    getWeaponName(key) {
        const map = { 'bow': '弓', 'gun': '枪', 'shoe': '鞋' };
        return map[key];
    }

    // --- 替换原来的 checkBalance ---
    checkBalance() {
        // 如果金币少于 10，就把召唤按钮变成灰色，或者隐藏，但不弹窗
        if (DataManager.data.coins < 10) {
            // 没钱时：召唤按钮变灰，不可点击
            this.spawnBtn.setBackgroundColor('#555');
            this.spawnBtn.setText(' 金币不足 (需10) ');
            this.spawnBtn.disableInteractive(); 
        } else {
            // 有钱时：恢复绿色，可以点击
            this.spawnBtn.setBackgroundColor('#00aa00');
            this.spawnBtn.setText(' 召唤猎物 (-10金币) ');
            this.spawnBtn.setInteractive();
        }
        
        // 注意：这里不再操作 adBtn 了，因为那个按钮已经被我们删了
    }

    // --- 刷怪逻辑 (含 V1.3 炸弹) ---
    startWave() {
        if (this.isSpawning) return;
        if (DataManager.spendCoins(10)) {
            this.isSpawning = true;
            this.updateUI();
            this.showToast("小心炸弹！"); // 提示语变化
            for (let i = 0; i < 10; i++) {
                let delay = Phaser.Math.Between(0, 5000);
                this.time.delayedCall(delay, () => {
                    this.spawnSingleTarget();
                    if (i === 9) this.time.delayedCall(2000, () => { this.isSpawning = false; });
                });
            }
        } else {
            this.showToast("金币不足");
            this.checkBalance();
        }
    }

    spawnSingleTarget() {
        const W = this.scale.width;
        const H = this.scale.height;
        
        // 1. 随机逻辑 (保持不变)
        let rand = Math.random();
        let type = 'bird';
        if (rand < 0.2) type = 'plane';
        else if (rand < 0.4) type = 'bomb';
        else if (rand < 0.6) type = 'ammo_box';

        let config = {
            'plane':    { yMin: 0.1, yMax: 0.2, scale: 0.6, speed: 300, color: 0xffff00 }, 
            'bomb':     { yMin: 0.2, yMax: 0.7, scale: 0.9, speed: 150, color: 0x000000 }, 
            'ammo_box': { yMin: 0.3, yMax: 0.5, scale: 0.8, speed: 150, color: 0x00ffff },
            'bird':     { yMin: 0.5, yMax: 0.8, scale: 1.0, speed: 100, color: 0xff0000 }
        }[type];

        let y = Phaser.Math.Between(H * config.yMin, H * config.yMax);
        
        // --- 调试日志：按 F12 看 Console ---
        // 如果你看不到这个日志，说明 startWave 没执行
        // 如果 W 特别大(比如几千)，说明 scale 模式有问题
        console.log(`生成怪: ${type} at x:${W + 50}, y:${y}`); 

        let target;
        
        if (this.textures.exists(type)) {
            target = this.physics.add.sprite(W + 50, y, type);
        } else {
            // --- 修正纯图形的物理生成 ---
            if (type === 'bomb') {
                target = this.add.circle(W + 50, y, 30, config.color);
                this.physics.add.existing(target);
                target.body.setCircle(30); // 修正圆形碰撞体大小
            } else {
                target = this.add.rectangle(W + 50, y, 60, 60, config.color);
                this.physics.add.existing(target);
            }
        }

        // 2. 加入组
        this.targets.add(target);

        // --- 关键修复 ---
        target.typeKey = type;
        target.body.allowGravity = false; // 【重要】强制关闭重力，防止它掉下去！
        target.body.velocity.x = -config.speed; // 直接设置 velocity 属性，比 setVelocityX 更稳妥
        target.body.velocity.y = 0; // 确保Y轴不乱动

        // 3. 销毁逻辑
        this.time.addEvent({ delay: 12000, callback: () => { 
            if(target && target.active) target.destroy(); 
        }});
    }

    // --- 射击逻辑 (含 V1.2 连击准备) ---
    fireWeapon(pointer, screenHeight) {
        if (pointer.y < 120 || pointer.y > screenHeight - 120) return;

        if (DataManager.data.ammo[this.currentWeapon] <= 0) {
            this.showToast("弹药不足");
            return;
        }

        DataManager.data.ammo[this.currentWeapon]--;
        DataManager.save();
        this.updateUI();

        let stats = {
            'bow':  { speed: 700,  size: 1.0, color: 0xffffff, maxHits: 1 },  // 弓箭：单体
            'gun':  { speed: 1200, size: 1.5, color: 0xaaaaaa, maxHits: 1 },  // 枪：单体
            'shoe': { speed: 1500, size: 3.0, color: 0xff00ff, maxHits: 99 }  // 鞋：无限穿透！
        }[this.currentWeapon];

        let bullet = this.add.rectangle(150, this.scale.height - 150, 20 * stats.size, 10 * stats.size, stats.color);
        this.physics.add.existing(bullet);
        this.bullets.add(bullet);

        // --- 关键：绑定穿透属性 ---
        bullet.maxHits = stats.maxHits; 
        bullet.hitCount = 0; // 当前已命中次数
        bullet.hitTargetIds = new Set(); // 记录命中过的物体，防止同一发子弹对同一个物体触发多次伤害

        if (this.currentWeapon === 'gun') {
            bullet.body.allowGravity = false;
            this.physics.moveTo(bullet, pointer.x, pointer.y, stats.speed);
        } else {
            bullet.body.setGravityY(this.currentWeapon === 'shoe' ? 400 : 200);
            this.physics.moveTo(bullet, pointer.x, pointer.y, stats.speed);
            if (this.currentWeapon === 'shoe') {
                this.tweens.add({ targets: bullet, angle: 360, duration: 200, repeat: -1 });
            } else {
                bullet.rotation = Phaser.Math.Angle.Between(150, this.scale.height - 150, pointer.x, pointer.y);
            }
        }

        this.physics.add.overlap(bullet, this.targets, this.handleHit, null, this);
    }

    // --- 碰撞逻辑 (核心修改：连击 + 炸弹) ---
    handleHit(bullet, target) {
        // 1. 检查这发子弹是否已经打过这个怪了（防止重叠时每帧都触发）
        // 虽然 target 马上会销毁，但为了逻辑严谨，防止 destroy 还没生效时的重复调用
        if (bullet.hitTargetIds.has(target)) return;
        
        bullet.hitTargetIds.add(target);
        bullet.hitCount++;

        // 2. 销毁目标
        target.destroy();

        // 3. 处理不同目标的逻辑
        if (target.typeKey === 'bomb') {
            // === 炸弹惩罚 ===
            DataManager.data.coins = Math.max(0, DataManager.data.coins - 20); // 扣20金币
            DataManager.save();
            this.updateUI();
            
            // 炸弹会强制销毁所有类型的子弹（哪怕是无敌的鞋子）
            bullet.destroy(); 
            
            // 特效：红色震动 + 扣分飘字
            this.cameras.main.shake(200, 0.02);
            this.showFloatingText(target.x, target.y, "-20金币!", '#ff0000', 50);
            return; // 炸弹中断连击，直接返回
        }

        // === 正常奖励逻辑 ===
        let msg = "";
        let color = '#ff0';
        let bonus = 0;

        if (target.typeKey === 'plane') {
            DataManager.data.coins += 10; msg = "+10";
        } else if (target.typeKey === 'ammo_box') {
            DataManager.data.ammo.gun += 2; msg = "枪弹+2"; color = '#00ffff';
        } else if (target.typeKey === 'bird') {
            DataManager.data.coins += 2; msg = "+2";
        }

        // === V1.2 连击奖励 ===
        if (bullet.hitCount >= 2) {
            // 从第二个目标开始，每个额外 +5 金币
            DataManager.data.coins += 5;
            msg = `连击! +5`; 
            color = '#00ff00'; // 绿色显示连击
            this.sound_play_combo(); // 假装这里有个音效
        }

        DataManager.save();
        this.updateUI();
        this.showFloatingText(target.x, target.y, msg, color, 32);

        // 4. 检查子弹是否该销毁
        if (bullet.hitCount >= bullet.maxHits) {
            bullet.destroy();
        }
    }
    
    sound_play_combo() {
        // 预留音效接口
    }

    showFloatingText(x, y, msg, color, size) {
        let txt = this.add.text(x, y, msg, { fontSize: `${size}px`, color: color, stroke: '#000', strokeThickness: 4, fontStyle: 'bold' }).setOrigin(0.5);
        this.tweens.add({ targets: txt, y: y - 80, alpha: 0, duration: 1000, onComplete: () => txt.destroy() });
    }

    watchAd() {
        this.callAdSDK(() => {
            DataManager.data.coins += 10;
            DataManager.save();
            this.updateUI();
            alert("观看成功 +10金币");
        });
    }

    callAdSDK(onSuccess) {
        setTimeout(() => { if (onSuccess) onSuccess(); }, 1000);
    }

    showToast(msg) {
        const W = this.scale.width;
        const H = this.scale.height;
        let txt = this.add.text(W / 2, H / 2, msg, { fontSize: '40px', backgroundColor: '#000', padding: 20 }).setOrigin(0.5).setDepth(100);
        this.tweens.add({ targets: txt, alpha: 0, duration: 1000, delay: 500, onComplete: () => txt.destroy() });
    }
}