window.DataManager = {
    defaultData: {
        coins: 100, // 初始资金 (不够买村庄，逼迫玩家先去射击)
        ammo: { bow: 50, gun: 0, sock: 0  }, 
        
        // 改为3个城市，默认全部未解锁 (需购买)
        unlockedCities: [false, false, false], 
        
        // 新增：记录每个城市的“打工结束时间戳” (0 表示当前空闲)
        cityCooldowns: [0, 0, 0],

        lastLoginDate: null,
        history: [] 
    },

    data: {},

    load() {
        const saved = localStorage.getItem('myGameData');
        if (saved) {
            // 合并数据，防止旧存档缺少 cityCooldowns 报错
            this.data = Object.assign({}, this.defaultData, JSON.parse(saved));
            
            // 兼容性处理：如果旧存档是5个城市，强制重置一下结构，避免报错
            if (this.data.unlockedCities.length !== 3) {
                this.data.unlockedCities = [false, false, false];
                this.data.cityCooldowns = [0, 0, 0];
            }
        } else {
            this.data = JSON.parse(JSON.stringify(this.defaultData));
        }
        this.checkDailyReset();
    },

    save() {
        localStorage.setItem('myGameData', JSON.stringify(this.data));
    },

    checkDailyReset() {
        // 这个游戏模式下，每日重置打工次数的逻辑其实已经不需要了
        // 因为限制变成了12小时CD，但保留这个函数结构以便后续扩展签到功能
        const today = new Date().toDateString();
        if (this.data.lastLoginDate !== today) {
            this.data.lastLoginDate = today;
            this.save();
        }
    },
    
    addHistory(type, amount, desc) {
        if (this.data.history.length > 50) this.data.history.shift();
        this.data.history.push({
            time: new Date().toLocaleString(),
            type, amount, desc
        });
        this.save();
    },

    spendCoins(amount) {
        if (this.data.coins >= amount) {
            this.data.coins -= amount;
            this.save();
            return true;
        }
        return false;
    }
};

window.DataManager.load();