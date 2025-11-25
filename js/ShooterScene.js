
class ShooterScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ShooterScene' });
    }

    preload() {
        // 在此加载图片素材
        this.load.image('bg_img', 'assets/background.png');
        // this.load.image('bomb', 'assets/bomb.png'); 

        this.load.image('plane', 'assets/Ship6.png');       // 飞机
        this.load.image('bomb', 'assets/bomb.png');         // 炸弹
        this.load.image('ammo_box', 'assets/ammo_box.png'); // 弹药箱
        this.load.image('bird', 'assets/bird.png');         // 鸟

        // === 2. 发射出的样子 ===
        this.load.image('bullet_bow', 'assets/arrow.png');  // 弓箭图片
        this.load.image('bullet_gun', 'assets/gun.jpg'); // 子弹图片
        this.load.image('bullet_sock', 'assets/sock.png');  // 袜子图片

        // 发射的基座
        this.load.image('weapon_bow', 'assets/bow.png');  // 弓的图片
        this.load.image('weapon_gun', 'assets/gun.jpg');  // 枪的图片
        this.load.image('weapon_sock', 'assets/sock.png'); // 手拿袜子的图片
    }

    update(time, delta) {
        // 遍历所有子弹，更新它们的旋转角度
        this.bullets.children.each(b => {
            if (b.active) {
                // 如果是弓箭 (没有旋转动画的)，让它根据当前飞行速度方向旋转
                // 这样弓箭上升时箭头朝上，下落时箭头会自动朝下
                if (this.currentWeapon !== 'sock') { 
                    b.rotation = b.body.velocity.angle();
                }
            }
        });
    }

    create() {

        // 1. 获取屏幕宽带
        const W = this.scale.width;
        const H = this.scale.height;

        // === 【新增】添加背景图 ===
        // 参数说明：x坐标, y坐标, 图片Key
        let bg = this.add.image(W / 2, H / 2, 'bg_img');

        // 关键设置：
        // 1. 铺满屏幕：强制把图片拉伸到和屏幕一样大
        bg.setDisplaySize(W, H);

        // 2. 层级调整：设置为 -1，确保它永远在所有物体(默认是0)的后面
        bg.setDepth(-1);

        // ... (背景色、物理组等代码保持不变) ...
        this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
        // const W = this.scale.width;
        // const H = this.scale.height;



        // 1. 定义发射点坐标 (保存到 this 变量，方便后面发射子弹时调用)
        this.fireX = 150;
        this.fireY = this.scale.height - 300;

        // 2. === 【新增】创建武器精灵 ===
        // 默认先显示弓 (weapon_bow)
        this.weaponSprite = this.add.sprite(this.fireX, this.fireY, 'weapon_bow');

        this.weaponSprite.setDepth(15); // 层级要在背景之上，UI之下
        // this.weaponSprite.setScale(0.5); // 如果图片太大，这里缩小一点

         // 【关键】设置旋转中心点
         this.weaponSprite.setOrigin(0, 0.5);


        this.currentWeapon = 'bow';

          // === 【新增】初始化时立即调用一次更新函数 ===
         // 这样它会立刻去读取配置里的 0.15 缩放比例，确保大小正确
         this.updatePlayerWeapon();
        this.isSpawning = false;

        this.bullets = this.physics.add.group();
        this.targets = this.physics.add.group();
        this.physics.world.setBounds(0, 0, W, H);

        this.createUI(W, H);

        // === 【新增】辅助线画笔 ===
        this.trajectoryGraphics = this.add.graphics().setDepth(20);

        // === 【修改】输入事件：改为拖拽瞄准 ===
        this.isAiming = false; // 标记是否正在瞄准

        // 1. 按下：开始瞄准
        this.input.on('pointerdown', (pointer) => {
            // 排除点击顶部UI区域
            if (pointer.y < 150 || pointer.y > H - 80) return;
            this.isAiming = true;
        });

        // 2. 移动：更新辅助线
        this.input.on('pointermove', (pointer) => {
            if (this.isAiming) {
                this.drawTrajectory(pointer);

                // === 【新增】计算角度并旋转武器 ===
                // 计算从 发射点(this.fireX, this.fireY) 到 鼠标位置(pointer.x, pointer.y) 的角度
                let angle = Phaser.Math.Angle.Between(this.fireX, this.fireY, pointer.x, pointer.y);

                // 设置武器旋转 (Phaser使用的是弧度，rotation属性接收弧度)
                this.weaponSprite.rotation = angle;
            }
        });

        // 3. 松开：发射！
        this.input.on('pointerup', (pointer) => {
            if (this.isAiming) {
                this.isAiming = false;
                this.trajectoryGraphics.clear(); // 清除辅助线
                this.fireWeapon(pointer); // 发射
            }
        });
    }

   
    // === 新增：更新主角手里的武器贴图 ===
    // === 修改后的 updatePlayerWeapon 方法 ===
    updatePlayerWeapon() {
        // 这里配置每种武器对应的【图片Key】和【缩放比例】
        // 数值越小图片越小 (0.1 是原图的 10%, 1.0 是原图的 100%)
        const config = {
            'bow':  { key: 'weapon_bow',  scale: 0.15 },  // 弓箭一般比较大，缩小多一点
            'gun':  { key: 'weapon_gun',  scale: 0.15 }, // 枪可能更细长
            'sock': { key: 'weapon_sock', scale: 0.2 }   // 袜子图片大小不一，看着调
        }[this.currentWeapon];
        
        // 检查图片是否存在
        if (this.textures.exists(config.key)) {
            this.weaponSprite.setTexture(config.key); // 换图
            this.weaponSprite.setScale(config.scale); // 换大小 (关键!)
            
            // 【可选】微调位置偏移
            // 如果发现有的武器握持位置不对，可以在这里重置一下原点
            this.weaponSprite.setOrigin(0, 0.5); 
        }
    }

    // --- 新增：绘制弹道辅助线 ---
    drawTrajectory(pointer) {
        this.trajectoryGraphics.clear();
        this.trajectoryGraphics.lineStyle(2, 0xffffff, 0.5); // 白色虚线

        // 起点 (也就是子弹发射的位置)
        // const startX = 150;
        // const startY = this.scale.height - 150;

        const startX = this.fireX;
        const startY = this.fireY;

        // 获取当前武器的参数
        const stats = this.getWeaponStats();

        // 计算发射角度和速度向量
        // 注意：弓箭和袜子有重力，枪是直线
        const angle = Phaser.Math.Angle.Between(startX, startY, pointer.x, pointer.y);
        const velocityX = Math.cos(angle) * stats.speed;
        const velocityY = Math.sin(angle) * stats.speed;
        const gravity = stats.gravity; // 我们需要在 getWeaponStats 里定义重力

        // 模拟物理路径：绘制 30 个点
        this.trajectoryGraphics.beginPath();
        this.trajectoryGraphics.moveTo(startX, startY);

        // 模拟未来 1秒内的路径 (时间步长 0.03秒)
        for (let t = 0; t <= 1.5; t += 0.03) {
            // 物理公式：位移 = 速度*时间 + 0.5*加速度*时间^2
            let dx = startX + velocityX * t;
            let dy = startY + velocityY * t + 0.5 * gravity * t * t;

            this.trajectoryGraphics.lineTo(dx, dy);

            // 如果碰到地面就停止绘制
            if (dy > this.scale.height || dx > this.scale.width) break;
        }
        this.trajectoryGraphics.strokePath();
    }

    // --- 抽取武器参数配置 (方便复用) ---
    // --- 抽取武器参数配置 (方便复用) ---
    getWeaponStats() {
        return {
            'bow': { 
                // 修改1：速度从 700 提高到 1200 (动力更足)
                // 修改2：重力从 200 降低到 150 (抛物线更平缓，能飞更远)
                speed: 1200, 
                gravity: 150, 
                size: 0.1, 
                color: 0xffffff, 
                maxHits: 1 
            },
            'gun': { 
                // 枪本身就没有重力，如果嫌慢也可以加度
                speed: 1500, // 原来是 1200
                gravity: 0, 
                size: 0.15, 
                color: 0xaaaaaa, 
                maxHits: 1 
            },
            'sock': { 
                // 袜子比较重，所以速度要给大一点
                speed: 1300, // 原来是 1000
                gravity: 350, // 原来是 400，稍微减轻一点重力
                size: 0.25, 
                color: 0xffaabb, 
                maxHits: 99 
            }
        }[this.currentWeapon];
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


        // === 【修改】召唤按钮：移到顶部，放在免费金币右边 ===
        // 既然金币按钮在 350，我们把召唤按钮放在 490 左右 (避免重叠)
        // 字体改小到 20px (原来是 36px)，防止挡住画面
        this.spawnBtn = this.add.text(490, 30, ' ⚡召唤(-10) ', {
            fontSize: '20px',
            backgroundColor: '#00aa00',
            padding: { x: 10, y: 5 },
            fontStyle: 'bold',
            color: '#fff'
        })
            .setOrigin(0, 0) // 左上角对齐，和金币按钮保持一致
            .setInteractive()
            .setDepth(11)
            .on('pointerdown', () => this.startWave());

        // --- 5. 商店与切换按钮 (保持不变) ---
        let startX = W - 350;
        this.createShopItem(startX, 20, 'bow', 10, 10, '买弓');
        this.createShopItem(startX + 110, 20, 'gun', 10, 5, '买枪');
        this.createShopItem(startX + 220, 20, 'sock', 10, 3, '买袜');

        this.createSwitchBtn(startX, 70, 'bow', '装备:弓');
        this.createSwitchBtn(startX + 110, 70, 'gun', '装备:枪');
        this.createSwitchBtn(startX + 220, 70, 'sock', '装备:袜');

        // --- 6. 底部召唤按钮 (保持不变) ---
        // this.spawnBtn = this.add.text(W / 2, H - 80, ' 召唤猎物 (-10金币) ', { 
        //     fontSize: '36px', backgroundColor: '#00aa00', padding: { x: 30, y: 20 }, fontStyle: 'bold'
        // })
        // .setOrigin(0.5).setInteractive().setDepth(10)
        // .on('pointerdown', () => this.startWave());

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

            this.updatePlayerWeapon();
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
            `   👟 臭袜: ${d.ammo.sock}`
        );

        // 刷新商店按钮的状态（可选）
        this.checkBalance();

        // 更新切换按钮的颜色（视觉反馈）
        this.updateSwitchButtons();
    }

    getWeaponName(key) {
        const map = { 'bow': '弓', 'gun': '枪', 'sock': '臭袜' };
        return map[key];
    }

    // --- 替换原来的 checkBalance ---
    checkBalance() {
        // 如果金币少于 10，就把召唤按钮变成灰色，或者隐藏，但不弹窗
        if (DataManager.data.coins < 10) {
            // 没钱时：召唤按钮变灰，不可点击
            this.spawnBtn.setBackgroundColor('#555');
            this.spawnBtn.setText(' ⚡金币不足 '); // 文字要简短，适应顶部空间
            this.spawnBtn.disableInteractive();
        } else {
            // 有钱时：恢复绿色，可以点击
            this.spawnBtn.setBackgroundColor('#00aa00');
            this.spawnBtn.setText(' ⚡召唤(-10) '); // 恢复正常文字
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
            'plane': { yMin: 0.1, yMax: 0.2, scale: 0.6, speed: 300, color: 0xffff00 },
            'bomb': { yMin: 0.2, yMax: 0.7, scale: 0.25, speed: 150, color: 0x000000 },
            'ammo_box': { yMin: 0.3, yMax: 0.5, scale: 0.25, speed: 150, color: 0x00ffff },
            'bird': { yMin: 0.5, yMax: 0.8, scale: 0.25, speed: 100, color: 0xff0000 }
        }[type];

        let y = Phaser.Math.Between(H * config.yMin, H * config.yMax);

        // --- 调试日志：按 F12 看 Console ---
        // 如果你看不到这个日志，说明 startWave 没执行
        // 如果 W 特别大(比如几千)，说明 scale 模式有问题
        console.log(`生成怪: ${type} at x:${W + 50}, y:${y}`);

        let target;

        if (this.textures.exists(type)) {
            target = this.physics.add.sprite(W + 50, y, type);
            target.setScale(config.scale);
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
        this.time.addEvent({
            delay: 12000, callback: () => {
                if (target && target.active) target.destroy();
            }
        });
    }

    // --- 射击逻辑 (含 V1.2 连击准备) ---
    fireWeapon(pointer) {
        // 检查弹药
        if (DataManager.data.ammo[this.currentWeapon] <= 0) {
            this.showToast("弹药不足! 请购买");
            return;
        }

        // 扣弹药
        DataManager.data.ammo[this.currentWeapon]--;
        DataManager.save();
        this.updateUI();

        // 获取参数
        const stats = this.getWeaponStats();
        // const startX = 150;
        // const startY = this.scale.height - 150;

        const startX = this.fireX;
        const startY = this.fireY;

        // // 生成子弹
        // // 袜子的颜色设个粉色或者贴图
        // let bullet = this.add.rectangle(startX, startY, 20 * stats.size, 10 * stats.size, stats.color);

        // // 如果是袜子，我们可以搞个简单的“旋转动画”模拟袜子在飞
        // if (this.currentWeapon === 'sock') {
        //     // 把矩形变得稍微不规则一点，像个袜子
        //     bullet.setSize(30, 15); 
        // }

        // this.physics.add.existing(bullet);

        let bullet;

        // 定义不同武器对应的图片 Key (要和 preload 里加载的一致)
        const textureMap = {
            'bow': 'bullet_bow',
            'gun': 'bullet_gun',
            'sock': 'bullet_sock'
        };
        const imgKey = textureMap[this.currentWeapon];

        // 检查是否加载了图片
        if (this.textures.exists(imgKey)) {
            // 使用图片
            bullet = this.physics.add.sprite(startX, startY, imgKey);
            bullet.setScale(stats.size); // 使用 stats 里的 size 控制图片缩放
        } else {
            // 如果没图片，还是用原来的方块代替（作为后备）
            bullet = this.add.rectangle(startX, startY, 20 * stats.size, 10 * stats.size, stats.color);
            this.physics.add.existing(bullet);
        }
        this.bullets.add(bullet);

        // 设置子弹属性
        bullet.maxHits = stats.maxHits;
        bullet.hitCount = 0;
        bullet.hitTargetIds = new Set();

        // --- 核心：根据角度设置速度 ---
        const angle = Phaser.Math.Angle.Between(startX, startY, pointer.x, pointer.y);

        // 设置重力
        bullet.body.setGravityY(stats.gravity);

        // 设置速度向量 (这样和我们的辅助线算法就完全一致了)
        bullet.body.setVelocity(
            Math.cos(angle) * stats.speed,
            Math.sin(angle) * stats.speed
        );

        // 旋转效果
        if (this.currentWeapon === 'sock') {
            // 袜子疯狂旋转
            this.tweens.add({ targets: bullet, angle: 360, duration: 300, repeat: -1 });
        } else {
            // 弓箭和枪随速度方向旋转
            bullet.rotation = angle;
            // 让弓箭在飞行中头部自动对准轨迹 (Arcade Physics 的小技巧)
            bullet.body.onWorldBounds = true; // 开启边界检测(可选)
            // 简单的随速度旋转逻辑在 update 中写比较好，这里简化处理，只设置初始角度
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