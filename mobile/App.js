import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, StatusBar, Animated, TouchableOpacity, Keyboard, Platform, LayoutAnimation, UIManager } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { User } from 'lucide-react-native';
import { useHabitData } from './src/useHabitData';
import Dashboard from './src/views/Dashboard';
import Patterns from './src/views/Patterns';
import Plans from './src/views/Plans';
import Profile from './src/views/Profile';
import Mood from './src/views/Mood';
import Support from './src/views/Support';
import BottomNav from './src/components/BottomNav';
import ErrorBoundary from './src/components/ErrorBoundary';
import { rescheduleAllNotifications, cancelAllNotifications } from './src/notifications';
import { checkForUpdate } from './src/updateCheck';
import UpdateBanner from './src/components/UpdateBanner';

// Mantém a splash screen nativa visível até o app carregar
SplashScreen.preventAutoHideAsync().catch(() => {});

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TAB_TRANSITION = {
  duration: 180,
  update: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
};

function AppInner() {
  const [activeTab, setActiveTabRaw] = useState('dashboard');
  const habitData = useHabitData();
  const [showAppSplash, setShowAppSplash] = useState(true);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const letters = ['1', '%'];
  const animations = useRef(letters.map(() => new Animated.Value(0))).current;
  const [appIsReady, setAppIsReady] = useState(false);
  const rootLayoutDone = useRef(false);
  const [availableUpdate, setAvailableUpdate] = useState(null);

  useEffect(() => {
    checkForUpdate().then(setAvailableUpdate);
  }, []);

  const setActiveTab = (tab) => {
    if (tab === activeTab) return;
    LayoutAnimation.configureNext(TAB_TRANSITION);
    setActiveTabRaw(tab);
  };

  const onRootLayout = useCallback(() => {
    if (!rootLayoutDone.current) {
      rootLayoutDone.current = true;
      // Só esconde a splash nativa depois que a primeira tela real já pintou,
      // evitando o "flash" branco entre a splash e o app.
      SplashScreen.hideAsync().catch(() => {});
    }
  }, []);

  useEffect(() => {
    async function prepare() {
      try {
        // Aqui poderíamos carregar fontes ou outras coisas pesadas
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidHideListener.remove();
      keyboardDidShowListener.remove();
    };
  }, []);

  useEffect(() => {
    if (!habitData.isLoaded) return;
    if (habitData.habit.notificationsEnabled) {
      rescheduleAllNotifications(habitData.habit).catch(() => {});
    } else {
      cancelAllNotifications().catch(() => {});
    }
  }, [
    habitData.isLoaded,
    habitData.habit.notificationsEnabled,
    habitData.habit.isTracking,
    habitData.habit.lastResetTimestamp,
    habitData.habit.name,
    habitData.habit.history.length,
    habitData.habit.moods.length,
    habitData.habit.plans.length,
  ]);

  useEffect(() => {
    if (appIsReady && habitData.isLoaded) {
      Animated.stagger(150, 
        animations.map(anim => 
          Animated.timing(anim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          })
        )
      ).start();

      const timer = setTimeout(() => {
        setShowAppSplash(false);
      }, 2200);

      return () => clearTimeout(timer);
    }
  }, [appIsReady, habitData.isLoaded]);

  if (!appIsReady || !habitData.isLoaded) {
    return null; // Retorna null para manter a tela de carregamento nativa
  }

  return (
    <SafeAreaProvider>
      {showAppSplash ? (
        <View style={styles.splash} onLayout={onRootLayout}>
          <StatusBar barStyle="light-content" backgroundColor="#0a0a0c" />
          <View style={styles.logoRow}>
            {letters.map((letter, index) => (
              <Animated.Text
                key={index}
                style={[
                  styles.splashText,
                  {
                    opacity: animations[index],
                    transform: [
                      {
                        translateY: animations[index].interpolate({
                          inputRange: [0, 1],
                          outputRange: [20, 0],
                        })
                      }
                    ]
                  }
                ]}
              >
                {letter}
              </Animated.Text>
            ))}
          </View>
        </View>
      ) : (
        <SafeAreaView style={styles.container} onLayout={onRootLayout}>
          <StatusBar barStyle="light-content" backgroundColor="#0a0a0c" />
          <View style={styles.content}>
            {activeTab === 'dashboard' && availableUpdate && (
              <UpdateBanner update={availableUpdate} onDismiss={() => setAvailableUpdate(null)} />
            )}
            {activeTab === 'dashboard' && <Dashboard {...habitData} onOpenProfile={() => setActiveTab('profile')} />}
            {activeTab === 'patterns' && <Patterns {...habitData} onOpenProfile={() => setActiveTab('profile')} />}
            {activeTab === 'mood' && <Mood {...habitData} onOpenProfile={() => setActiveTab('profile')} />}
            {activeTab === 'plans' && <Plans {...habitData} onOpenProfile={() => setActiveTab('profile')} />}
            {activeTab === 'support' && <Support {...habitData} onOpenProfile={() => setActiveTab('profile')} />}
            {activeTab === 'profile' && <Profile {...habitData} onBack={() => setActiveTab('dashboard')} />}
          </View>
          {!isKeyboardVisible && activeTab !== 'profile' && (
            <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
          )}
        </SafeAreaView>
      )}
    </SafeAreaProvider>
  );
}

export default function App() {
  const [instanceKey, setInstanceKey] = useState(0);
  return (
    <ErrorBoundary onReset={() => setInstanceKey((k) => k + 1)}>
      <AppInner key={instanceKey} />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#0a0a0c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoRow: {
    flexDirection: 'row',
  },
  splashText: {
    color: '#a855f7',
    fontSize: 48,
    fontWeight: 'bold',
    letterSpacing: 10,
  },
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  profileBtn: {
    backgroundColor: '#121217',
    padding: 12,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  content: {
    flex: 1,
  },
});
