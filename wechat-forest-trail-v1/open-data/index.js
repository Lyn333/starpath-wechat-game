const draw = (title, rows) => {
  const canvas = wx.getSharedCanvas(); const ctx = canvas.getContext("2d"); const width = canvas.width || 360; const height = canvas.height || 360;
  ctx.clearRect(0, 0, width, height); ctx.fillStyle = "rgba(255,253,248,.98)"; ctx.fillRect(0, 0, width, height); ctx.fillStyle = "#25313a"; ctx.font = "700 24px sans-serif"; ctx.textAlign = "center"; ctx.fillText(title, width / 2, 42);
  if (!rows.length) { ctx.fillStyle = "#74706a"; ctx.font = "16px sans-serif"; ctx.fillText("暂无已同步好友成绩", width / 2, 104); return; }
  rows.slice(0, 20).forEach((item, index) => { const y = 82 + index * 34; ctx.fillStyle = index < 3 ? "#e36a3e" : "#303b40"; ctx.font = "700 16px sans-serif"; ctx.textAlign = "left"; ctx.fillText(`${index + 1}. ${item.nickname || "微信好友"}`, 24, y); ctx.textAlign = "right"; ctx.fillText(String(item.score), width - 24, y); });
};

wx.onMessage((message) => {
  if (message?.type !== "SHOW_FRIEND_RANK") return;
  wx.getFriendCloudStorage({ keyList: [message.key], success: (response) => {
    const rows = (response.data || []).map((item) => ({ nickname: item.nickname, score: Number((item.KVDataList || []).find((entry) => entry.key === message.key)?.value) })).filter((item) => Number.isFinite(item.score)).sort((a, b) => b.score - a.score);
    draw(message.title || "好友榜", rows);
  }, fail: () => draw(message.title || "好友榜", []) });
});
