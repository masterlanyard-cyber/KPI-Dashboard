import React from 'react';
import './DashboardPanel.css';

const panelData = [
  {
    title: 'Total Earnings',
    value: '$950',
    change: '+7%',
    desc: 'This month',
    highlight: true,
    changeColor: 'green',
  },
  {
    title: 'Total Spending',
    value: '$700',
    change: '-5%',
    desc: 'This month',
    highlight: false,
    changeColor: 'red',
  },
  {
    title: 'Total Income',
    value: '$1,050',
    change: '+6%',
    desc: 'This month',
    highlight: false,
    changeColor: 'green',
  },
  {
    title: 'Total Revenue',
    value: '$850',
    change: '+4%',
    desc: 'This month',
    highlight: false,
    changeColor: 'green',
  },
];

export default function DashboardPanel() {
  return (
    <div className="dashboard-panel-grid">
      {panelData.map((panel, idx) => (
        <div
          key={panel.title}
          className={
            'dashboard-panel-card' + (panel.highlight ? ' highlight' : '')
          }
        >
          <div className="panel-title">{panel.title}</div>
          <div className="panel-value">{panel.value}</div>
          <div className="panel-footer">
            <span className={
              'panel-change ' + (panel.changeColor === 'red' ? 'down' : 'up')
            }>{panel.change}</span>
            <span className="panel-desc">{panel.desc}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
