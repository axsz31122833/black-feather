import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'accounts');

// 確保數據目錄存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 示例司機數據
const demoDrivers = [
  {
    phone: '0912345001',
    profile: {
      role: 'driver',
      name: '張大明',
      status: 'idle',
      vehicle: {
        plate: 'ABC-1234',
        model: 'Toyota Camry',
        color: '白色'
      },
      rating: 4.8,
      totalTrips: 156,
      joinDate: '2023-01-15'
    },
    orders: []
  },
  {
    phone: '0912345002',
    profile: {
      role: 'driver',
      name: '李小華',
      status: 'idle',
      vehicle: {
        plate: 'DEF-5678',
        model: 'Honda Accord',
        color: '黑色'
      },
      rating: 4.9,
      totalTrips: 203,
      joinDate: '2023-02-20'
    },
    orders: []
  },
  {
    phone: '0912345003',
    profile: {
      role: 'driver',
      name: '王美麗',
      status: 'idle',
      vehicle: {
        plate: 'GHI-9012',
        model: 'Nissan Sentra',
        color: '銀色'
      },
      rating: 4.7,
      totalTrips: 89,
      joinDate: '2023-03-10'
    },
    orders: []
  },
  {
    phone: '0912345004',
    profile: {
      role: 'driver',
      name: '陳志強',
      status: 'offline',
      vehicle: {
        plate: 'JKL-3456',
        model: 'Mazda 3',
        color: '紅色'
      },
      rating: 4.6,
      totalTrips: 134,
      joinDate: '2023-01-25'
    },
    orders: []
  },
  {
    phone: '0912345005',
    profile: {
      role: 'driver',
      name: '林玉珍',
      status: 'idle',
      vehicle: {
        plate: 'MNO-7890',
        model: 'Hyundai Elantra',
        color: '藍色'
      },
      rating: 4.9,
      totalTrips: 267,
      joinDate: '2022-12-01'
    },
    orders: []
  }
];

// 示例乘客數據
const demoPassengers = [
  {
    phone: '0987654001',
    profile: {
      role: 'passenger',
      name: '劉小明',
      totalTrips: 45,
      rating: 4.8,
      joinDate: '2023-06-15'
    },
    orders: []
  },
  {
    phone: '0987654002',
    profile: {
      role: 'passenger',
      name: '蔡美麗',
      totalTrips: 23,
      rating: 4.9,
      joinDate: '2023-08-20'
    },
    orders: []
  }
];

// 管理員數據
const adminUser = {
  phone: '0900000000',
  profile: {
    role: 'admin',
    name: '系統管理員',
    permissions: ['manage_drivers', 'view_orders', 'manage_system'],
    joinDate: '2023-01-01'
  },
  orders: []
};

function writeUserData(phone, file, data) {
  try {
    const userDir = path.join(DATA_DIR, phone);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    const filePath = path.join(userDir, file);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`寫入用戶數據失敗: ${phone}/${file}`, error);
    return false;
  }
}

// 初始化示例數據
function initializeDemoData() {
  console.log('正在初始化示例數據...');
  
  // 創建司機數據
  demoDrivers.forEach(driver => {
    writeUserData(driver.phone, 'profile.json', driver.profile);
    writeUserData(driver.phone, 'orders.json', driver.orders);
    console.log(`已創建司機: ${driver.profile.name} (${driver.phone})`);
  });
  
  // 創建乘客數據
  demoPassengers.forEach(passenger => {
    writeUserData(passenger.phone, 'profile.json', passenger.profile);
    writeUserData(passenger.phone, 'orders.json', passenger.orders);
    console.log(`已創建乘客: ${passenger.profile.name} (${passenger.phone})`);
  });
  
  // 創建管理員數據
  writeUserData(adminUser.phone, 'profile.json', adminUser.profile);
  writeUserData(adminUser.phone, 'orders.json', adminUser.orders);
  console.log(`已創建管理員: ${adminUser.profile.name} (${adminUser.phone})`);
  
  console.log('示例數據初始化完成！');
  console.log('\n可用的測試帳號:');
  console.log('===================');
  console.log('司機帳號:');
  demoDrivers.forEach(driver => {
    console.log(`  ${driver.profile.name}: ${driver.phone}`);
  });
  console.log('\n乘客帳號:');
  demoPassengers.forEach(passenger => {
    console.log(`  ${passenger.profile.name}: ${passenger.phone}`);
  });
  console.log('\n管理員帳號:');
  console.log(`  ${adminUser.profile.name}: ${adminUser.phone}`);
}

// 如果直接運行此文件，則初始化數據
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDemoData();
}

export { initializeDemoData };
