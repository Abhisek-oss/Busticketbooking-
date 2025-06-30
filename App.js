import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, Button, FlatList, TouchableOpacity,
  Alert, Image, ScrollView, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { initializeApp } from 'firebase/app';
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged,
} from 'firebase/auth';

// --- CONFIG ---
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDQqYOzS9ayO1rwBnB7oUtnOPbduwKN_-Y",
  authDomain: "busticketbookingapp.firebaseapp.com",
  projectId: "busticketbookingapp",
  messagingSenderId: "1045249778101",
  appId: "1:1045249778101:android:e9182f8109f49f237339fc",
};
const BACKEND_URL = 'https://luther-calculations-screenshots-losing.trycloudflare.com';
const IMGUR_CLIENT_ID = 'bf9161f8d311d46';

// Initialize Firebase
const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);

export default function App() {
  // Auth state
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Login/signup fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  // Data states
  const [buses, setBuses] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);

  // Seat selection
  const [selectedBus, setSelectedBus] = useState(null);
  const [selectedSeat, setSelectedSeat] = useState(null);

  // Admin bus add/edit
  const [busName, setBusName] = useState('');
  const [busTotalSeats, setBusTotalSeats] = useState('');
  const [editBusId, setEditBusId] = useState(null);

  // Image upload
  const [imageUploading, setImageUploading] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState(null);

  // Listen auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async currentUser => {
      if (currentUser) {
        setUser(currentUser);
        // Check admin role
        try {
          const userDoc = await fetch(`${BACKEND_URL}/users/${currentUser.uid}`).then(r => r.json());
          setIsAdmin(userDoc.role === 'admin');
          fetchBuses();
          fetchBookings(currentUser.uid);
        } catch {
          setIsAdmin(false);
          setBuses([]);
          setBookings([]);
        }
      } else {
        setUser(null);
        setIsAdmin(false);
        setBuses([]);
        setBookings([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch buses
  async function fetchBuses() {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/buses`);
      const data = await res.json();
      setBuses(data);
    } catch {
      Alert.alert('Error', 'Failed to fetch buses');
    }
    setLoading(false);
  }

  // Fetch bookings
  async function fetchBookings(userId) {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/bookings`, {
        headers: { 'x-user-id': userId }
      });
      const data = await res.json();
      setBookings(data);
    } catch {
      Alert.alert('Error', 'Failed to fetch bookings');
    }
    setLoading(false);
  }

  // Signup
  async function handleSignup() {
    if (!email || !password || !name) {
      Alert.alert('Fill all fields');
      return;
    }
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await fetch(`${BACKEND_URL}/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: cred.user.uid, name, email }),
      });
    } catch (e) {
      Alert.alert('Signup error', e.message);
    }
  }

  // Login
  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Fill email and password');
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      Alert.alert('Login error', e.message);
    }
  }

  // Logout
  async function handleLogout() {
    await signOut(auth);
  }

  // Book seat
  async function bookSeat() {
    if (!selectedBus || selectedSeat == null) {
      Alert.alert('Select Bus and Seat');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.uid
        },
        body: JSON.stringify({ busId: selectedBus.id, seatNumber: selectedSeat })
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert('Success', 'Seat booked!');
        fetchBookings(user.uid);
        setSelectedSeat(null);
        setSelectedBus(null);
      } else {
        Alert.alert('Error', data.message || 'Booking failed');
      }
    } catch {
      Alert.alert('Error', 'Booking failed');
    }
    setLoading(false);
  }

  // Cancel booking
  async function cancelBooking(id) {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/bookings/${id}/cancel`, {
        method: 'POST',
        headers: { 'x-user-id': user.uid },
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert('Canceled');
        fetchBookings(user.uid);
      } else {
        Alert.alert('Error', data.message || 'Cancel failed');
      }
    } catch {
      Alert.alert('Error', 'Cancel failed');
    }
    setLoading(false);
  }

  // Payment simulate
  async function payForBooking(bookingId) {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/payments/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert('Payment verified');
        fetchBookings(user.uid);
      } else {
        Alert.alert('Error', data.message || 'Payment failed');
      }
    } catch {
      Alert.alert('Error', 'Payment failed');
    }
    setLoading(false);
  }

  // Admin add/update bus
  async function adminAddOrUpdateBus() {
    if (!busName || !busTotalSeats) {
      Alert.alert('Fill all bus fields');
      return;
    }
    setLoading(true);
    try {
      const method = editBusId ? 'PUT' : 'POST';
      const url = editBusId ? `${BACKEND_URL}/buses/${editBusId}` : `${BACKEND_URL}/buses`;
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'admin'
        },
        body: JSON.stringify({
          name: busName,
          totalSeats: parseInt(busTotalSeats),
          imageUrl: uploadedImageUrl || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert(editBusId ? 'Bus updated' : 'Bus added');
        setBusName('');
        setBusTotalSeats('');
        setEditBusId(null);
        setUploadedImageUrl(null);
        fetchBuses();
      } else {
        Alert.alert('Error', data.message || (editBusId ? 'Update bus failed' : 'Add bus failed'));
      }
    } catch {
      Alert.alert('Error', editBusId ? 'Update bus failed' : 'Add bus failed');
    }
    setLoading(false);
  }

  // Admin delete bus
  function adminDeleteBus(id) {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this bus?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            setLoading(true);
            try {
              const res = await fetch(`${BACKEND_URL}/buses/${id}`, {
                method: 'DELETE',
                headers: { 'x-user-role': 'admin' },
              });
              const data = await res.json();
              if (res.ok) {
                Alert.alert('Bus deleted');
                fetchBuses();
              } else {
                Alert.alert('Error', data.message || 'Delete bus failed');
              }
            } catch {
              Alert.alert('Error', 'Delete bus failed');
            }
            setLoading(false);
          }
        }
      ]
    );
  }

  // Image Picker & upload to Imgur
  async function pickImageAndUpload() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required to access photos');
      return;
    }
    let pickerResult = await ImagePicker.launchImageLibraryAsync({
      base64: true,
      quality: 0.7,
    });
    if (pickerResult.cancelled) return;

    setImageUploading(true);
    try {
      const res = await fetch('https://api.imgur.com/3/image', {
        method: 'POST',
        headers: {
          Authorization: `Client-ID ${IMGUR_CLIENT_ID}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: pickerResult.base64,
          type: 'base64',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setUploadedImageUrl(data.data.link);
        Alert.alert('Image uploaded!');
      } else {
        Alert.alert('Upload failed');
      }
    } catch {
      Alert.alert('Upload failed');
    }
    setImageUploading(false);
  }

  // UI: Show signup/login if no user
  if (!user) {
    return (
      <ScrollView contentContainerStyle={{ padding: 20, flexGrow: 1, justifyContent: 'center' }}>
        <Text style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' }}>
          Bus Ticket Booking
        </Text>
        <TextInput
          placeholder="Full Name"
          style={styles.input}
          value={name}
          onChangeText={setName}
        />
        <TextInput
          placeholder="Email"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
        />
        <TextInput
          placeholder="Password"
          style={styles.input}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <Button title="Login" onPress={handleLogin} />
        <View style={{ height: 10 }} />
        <Button title="Sign Up" onPress={handleSignup} />
      </ScrollView>
    );
  }

  // Prepare booked seats for selected bus
  const bookedSeats = bookings
    .filter(b => b.busId === selectedBus?.id && ['pending', 'confirmed'].includes(b.status))
    .map(b => b.seatNumber);

  return (
    <ScrollView contentContainerStyle={{ padding: 20, flexGrow: 1 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Hello, {user.email}</Text>
      <Button title="Logout" onPress={handleLogout} />
      {loading && <ActivityIndicator style={{ marginVertical: 10 }} />}

      {/* Bus List */}
      <View style={{ marginVertical: 15 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Buses</Text>
        <FlatList
          data={buses}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={{
              backgroundColor: selectedBus?.id === item.id ? '#a0e3f7' : '#e0f7fa',
              padding: 10,
              marginVertical: 5,
              borderRadius: 8,
            }}>
              <TouchableOpacity onPress={() => setSelectedBus(item)}>
                <Text>{item.name} ({item.totalSeats} seats)</Text>
              </TouchableOpacity>
              {isAdmin && (
                <View style={{ flexDirection: 'row', marginTop: 5 }}>
                  <Button
                    title="Edit"
                    onPress={() => {
                      setEditBusId(item.id);
                      setBusName(item.name);
                      setBusTotalSeats(item.totalSeats.toString());
                      setSelectedBus(null);
                      setSelectedSeat(null);
                      setUploadedImageUrl(null);
                    }}
                  />
                  <View style={{ width: 10 }} />
                  <Button
                    title="Delete"
                    color="red"
                    onPress={() => adminDeleteBus(item.id)}
                  />
                </View>
              )}
            </View>
          )}
        />
      </View>

      {/* Seat selection */}
      {selectedBus && (
        <View style={{ marginVertical: 15 }}>
          <Text style={{ fontWeight: 'bold' }}>Select seat for {selectedBus.name}:</Text>
          <ScrollView horizontal style={{ marginVertical: 10 }}>
            {[...Array(selectedBus.totalSeats).keys()].map(i => {
              const seatNum = i + 1;
              const disabled = bookedSeats.includes(seatNum);
              return (
                <TouchableOpacity
                  key={seatNum}
                  style={{
                    padding: 10,
                    marginRight: 8,
                    backgroundColor: selectedSeat === seatNum ? '#007aff' : disabled ? '#ccc' : '#e0f7fa',
                    borderRadius: 4,
                  }}
                  disabled={disabled}
                  onPress={() => setSelectedSeat(seatNum)}
                >
                  <Text style={{ color: disabled ? '#666' : (selectedSeat === seatNum ? '#fff' : '#000') }}>
                    {seatNum}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <Button title="Book Seat" onPress={bookSeat} disabled={!selectedSeat || loading} />
        </View>
      )}

      {/* Bookings */}
      <View style={{ marginVertical: 15 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Your Bookings</Text>
        {bookings.length === 0 && <Text>No bookings yet</Text>}
        <FlatList
          data={bookings}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            const busName = buses.find(b => b.id === item.busId)?.name || item.busId;
            return (
              <View style={{
                backgroundColor: '#f0f0f0',
                padding: 10,
                marginVertical: 5,
                borderRadius: 6,
              }}>
                <Text>Bus: {busName}</Text>
                <Text>Seat: {item.seatNumber}</Text>
                <Text>Status: {item.status}</Text>
                <Text>Payment: {item.paymentStatus || 'unpaid'}</Text>
                {item.status !== 'canceled' && (
                  <>
                    <Button
                      title="Cancel Booking"
                      color="red"
                      onPress={() => cancelBooking(item.id)}
                      disabled={loading}
                    />
                    {item.paymentStatus !== 'paid' && (
                      <View style={{ marginTop: 6 }}>
                        <Button
                          title="Pay Now (Simulated)"
                          onPress={() => payForBooking(item.id)}
                          disabled={loading}
                        />
                      </View>
                    )}
                  </>
                )}
              </View>
            );
          }}
        />
      </View>

      {/* Admin Panel */}
      {isAdmin && (
        <View style={{ marginVertical: 20, padding: 10, backgroundColor: '#ffeecc', borderRadius: 10 }}>
          <Text style={{ fontWeight: 'bold', fontSize: 18 }}>
            {editBusId ? 'Edit Bus' : 'Add Bus'}
          </Text>
          <TextInput
            placeholder="Bus Name"
            style={styles.input}
            value={busName}
            onChangeText={setBusName}
          />
          <TextInput
            placeholder="Total Seats"
            style={styles.input}
            keyboardType="number-pad"
            value={busTotalSeats}
            onChangeText={setBusTotalSeats}
          />
          <Button
            title={editBusId ? 'Update Bus' : 'Add Bus'}
            onPress={adminAddOrUpdateBus}
            disabled={loading}
          />
          <View style={{ height: 10 }} />
          <Button
            title={imageUploading ? 'Uploading Image...' : 'Pick and Upload Image'}
            onPress={pickImageAndUpload}
            disabled={imageUploading}
          />
          {uploadedImageUrl && (
            <Image
              source={{ uri: uploadedImageUrl }}
              style={{ width: 200, height: 120, marginTop: 10 }}
              resizeMode="cover"
            />
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = {
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 10,
    marginBottom: 10,
  },
};
