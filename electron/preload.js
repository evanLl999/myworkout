const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 数据库操作（阶段 1 实现）
  invoke: (channel, ...args) => {
    const allowedChannels = [
      'db:getConfigsByDay',
      'db:getAllConfigs',
      'db:addExercise',
      'db:updateExercise',
      'db:deleteExercise',
      'db:getOrCreateSession',
      'db:getSessionByDate',
      'db:completeSession',
      'db:startTraining',
      'db:endTraining',
      'db:resetSession',
      'db:addSetLog',
      'db:getSetLogs',
      'db:getCompletedSetCount',
      'db:updateWeight',
      'db:getWeightHistory',
    ];
    if (allowedChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    return Promise.reject(new Error(`不允许的 IPC 通道: ${channel}`));
  },
});
