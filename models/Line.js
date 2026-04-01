const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Line = sequelize.define('Line', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    lineId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    text: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ''
    },
    nextLineId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    scenarioId: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
}, {
    tableName: 'lines',
    timestamps: false
});

module.exports = Line;
