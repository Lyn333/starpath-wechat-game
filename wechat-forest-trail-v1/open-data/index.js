// 主域会把 sharedCanvas 尺寸设为弹窗内容区（已乘 dpr），标题由主域绘制，这里只画榜单行。
const draw = (rows) => {
  const canvas = wx.getSharedCanvas(); const ctx = canvas.getContext("2d"); const width = canvas.width || 360; const height = canvas.height || 360;
  const scale = Math.max(1, width / 360); const rowHeight = 34 * scale;
  ctx.clearRect(0, 0, width, height); ctx.fillStyle = "rgba(255,253,248,.98)"; ctx.fillRect(0, 0, width, height);
  if (!rows.length) { ctx.fillStyle = "#74706a"; ctx.font = `${16 * scale}px sans-serif`; ctx.textAlign = "center"; ctx.fillText("暂无已同步好友成绩", width / 2, 60 * scale); return; }
  const visible = Math.max(1, Math.floor((height - 20 * scale) / rowHeight));
  rows.slice(0, visible).forEach((item, index) => { const y = (30 + index * 34) * scale; ctx.fillStyle = index < 3 ? "#e36a3e" : "#303b40"; ctx.font = `700 ${16 * scale}px sans-serif`; ctx.textAlign = "left"; ctx.fillText(`${index + 1}. ${item.nickname || "微信好友"}`, 24 * scale, y); ctx.textAlign = "right"; ctx.fillText(String(item.score), width - 24 * scale, y); });
};

wx.onMessage((message) => {
  if (message?.type !== "SHOW_FRIEND_RANK") return;
  draw([]);
  wx.getFriendCloudStorage({ keyList: [message.key], success: (response) => {
    const rows = (response.data || []).map((item) => ({ nickname: item.nickname, score: Number((item.KVDataList || []).find((entry) => entry.key === message.key)?.value) })).filter((item) => Number.isFinite(item.score)).sort((a, b) => b.score - a.score);
    draw(rows);
  }, fail: () => draw([]) });
});
