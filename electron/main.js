const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const db = require('./database');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'MyWorkOut - 健身日志',
  });

  // 开发模式加载 Vite dev server
  if (process.env.NODE_ENV !== 'production') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// ========== 数据库 IPC 处理 ==========

function safeHandler(fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      console.error('数据库操作失败:', err.message);
      throw err;
    }
  };
}

function registerIpcHandlers() {
  ipcMain.handle('db:getConfigsByDay', safeHandler((_event, dayOfWeek) => {
    return db.getConfigsByDay(dayOfWeek);
  }));

  ipcMain.handle('db:getAllConfigs', safeHandler(() => {
    return db.getAllConfigs();
  }));

  ipcMain.handle('db:addExercise', safeHandler((_event, data) => {
    return db.addExercise(data);
  }));

  ipcMain.handle('db:updateExercise', safeHandler((_event, id, fields) => {
    return db.updateExercise(id, fields);
  }));

  ipcMain.handle('db:deleteExercise', safeHandler((_event, id) => {
    return db.deleteExercise(id);
  }));

  ipcMain.handle('db:getOrCreateSession', safeHandler((_event, date) => {
    return db.getOrCreateSession(date);
  }));

  ipcMain.handle('db:getSessionByDate', safeHandler((_event, date) => {
    return db.getSessionByDate(date);
  }));

  ipcMain.handle('db:completeSession', safeHandler((_event, sessionId) => {
    return db.completeSession(sessionId);
  }));

  ipcMain.handle('db:startTraining', safeHandler((_event, sessionId) => {
    return db.startTraining(sessionId);
  }));

  ipcMain.handle('db:endTraining', safeHandler((_event, sessionId) => {
    return db.endTraining(sessionId);
  }));

  ipcMain.handle('db:resetSession', safeHandler((_event, sessionId) => {
    return db.resetSession(sessionId);
  }));

  ipcMain.handle('db:addSetLog', safeHandler((_event, sessionId, exerciseConfigId, setNumber, weightUsed, repsDone) => {
    return db.addSetLog(sessionId, exerciseConfigId, setNumber, weightUsed, repsDone);
  }));

  ipcMain.handle('db:getSetLogs', safeHandler((_event, sessionId) => {
    return db.getSetLogs(sessionId);
  }));

  ipcMain.handle('db:getCompletedSetCount', safeHandler((_event, sessionId, exerciseConfigId) => {
    return db.getCompletedSetCount(sessionId, exerciseConfigId);
  }));

  ipcMain.handle('db:updateWeight', safeHandler((_event, exerciseConfigId, newWeight) => {
    return db.updateWeight(exerciseConfigId, newWeight);
  }));

  ipcMain.handle('db:getWeightHistory', safeHandler((_event, exerciseConfigId) => {
    return db.getWeightHistory(exerciseConfigId);
  }));
}

app.whenReady().then(async () => {
  await db.initDatabase();
  registerIpcHandlers();
  createWindow();
});

app.on('before-quit', () => {
  db.saveDb();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
