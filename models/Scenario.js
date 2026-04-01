const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Scenario = sequelize.define('Scenario', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'Neimenovani scenarij'
    }
}, {
    tableName: 'scenarios',
    timestamps: false
});

module.exports = Scenario;
