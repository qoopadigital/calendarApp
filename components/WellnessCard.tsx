import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface WellnessCardProps {
    emoji: string;
    label: string;
    value: number;
    maxValue: number;
    unit: string;
    color: string;
}

const RING_SIZE = 90;
const STROKE_WIDTH = 8;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function WellnessCard({
    emoji,
    label,
    value,
    maxValue,
    unit,
    color,
}: WellnessCardProps) {
    const progress = Math.min(value / maxValue, 1);
    const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

    // Formatear valor para display
    const displayValue =
        Number.isInteger(value) ? value.toLocaleString() : value.toFixed(1);

    return (
        <View style={styles.card}>
            <Svg width={RING_SIZE} height={RING_SIZE}>
                {/* Track (fondo) */}
                <Circle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={RADIUS}
                    stroke="#E5E7EB"
                    strokeWidth={STROKE_WIDTH}
                    fill="none"
                />
                {/* Progreso */}
                <Circle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={RADIUS}
                    stroke={color}
                    strokeWidth={STROKE_WIDTH}
                    fill="none"
                    strokeDasharray={CIRCUMFERENCE}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    rotation={-90}
                    origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
                />
            </Svg>

            {/* Contenido centrado encima del SVG */}
            <View style={styles.overlay}>
                <Text style={styles.emoji}>{emoji}</Text>
                <Text style={[styles.value, { color }]}>
                    {displayValue}
                </Text>
                <Text style={styles.unit}>{unit}</Text>
            </View>

            <Text style={styles.label}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
        minWidth: 100,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        top: 0,
        height: RING_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emoji: {
        fontSize: 18,
    },
    value: {
        fontSize: 14,
        fontWeight: '700',
        marginTop: 1,
    },
    unit: {
        fontSize: 10,
        color: '#6B7280',
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        color: '#374151',
        marginTop: 8,
    },
});
