'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import Whiteboard from './components/Whiteboard';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateTwoWordName } from '@/lib/name-generator';
import type { ClientToServerEvents, ServerToClientEvents, Student as StudentType } from '@/types/socket';

let socket: Socket<ServerToClientEvents, ClientToServerEvents>;

interface Student extends StudentType {}

export default function Home() {
  const [isConnected, setIsConnected] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  const [classCode, setClassCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [studentId, setStudentId] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    const initSocket = async () => {
      try {
        // Initialize socket connection
        const socketUrl = 'http://localhost:3001';
        console.log('Connecting to socket at:', socketUrl);

        // Create socket instance
        socket = io(socketUrl, {
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          autoConnect: true,
        });

        // Set up event listeners
        socket.on('connect', () => {
          console.log('Connected to server with ID:', socket.id);
          setIsConnected(true);
          setError(null);
          if (socket.id) {
            setStudentId(socket.id);
            const newName = generateTwoWordName();
            setDisplayName(newName);
            console.log('Generated name:', newName);
          }
        });

        socket.on('connect_error', (err) => {
          console.error('Connection error:', err);
          setError('Failed to connect to GalleryBoard server. Please try connecting again.');
          setIsConnected(false);
        });

        socket.on('classroom-created', ({ classCode: newClassCode }) => {
          console.log('Classroom created:', newClassCode);
          setClassCode(newClassCode);
        });

        socket.on('student-joined', ({ studentId, displayName, students: updatedStudents }) => {
          console.log('Student joined:', { studentId, displayName });
          setStudents(updatedStudents);
        });

        socket.on('name-assigned', ({ displayName: assignedName }) => {
          console.log('Name assigned:', assignedName);
          setDisplayName(assignedName);
        });

        socket.on('student-left', ({ students: updatedStudents }) => {
          setStudents(updatedStudents);
        });

        // Initialize connection
        await fetch('/api/socket/io');
      } catch (err) {
        console.error('Socket initialization error:', err);
        setError('Failed to initialize connection. Please refresh the page.');
      }
    };

    initSocket();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  const createClassroom = () => {
    if (!socket.id) return;
    setIsTeacher(true);
    socket.emit('create-classroom', socket.id);
  };

  const joinClassroom = () => {
    if (!socket.id || !inputCode) return;
    console.log('Joining classroom with name:', displayName);
    socket.emit('join-classroom', { 
      classCode: inputCode, 
      studentId: socket.id,
      displayName: displayName
    });
    setClassCode(inputCode);
  };

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-center text-foreground">
              {error || 'Connecting to GalleryBoard server...'}
            </p>
            {error && (
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                className="w-full"
              >
                Retry Connection
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!classCode) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">GalleryBoard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={createClassroom}
              className="w-full"
              size="lg"
              variant="default"
            >
              Create Classroom (Teacher)
            </Button>
            <div className="flex flex-col space-y-2">
              <Input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                placeholder="Enter class code"
                className="text-center"
              />
              <Button 
                onClick={joinClassroom}
                variant="secondary"
                size="lg"
                className="w-full"
              >
                Join Classroom
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isTeacher) {
    return (
      <div className="p-8 bg-background">
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Class Code: {classCode}</h2>
                <p className="text-muted-foreground">Connected Students: {students.length}</p>
              </div>
              {selectedStudent && (
                <Button
                  onClick={() => setSelectedStudent(null)}
                  variant="outline"
                >
                  Back to Grid
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {selectedStudent ? (
          <Card>
            <CardContent className="p-6">
              <Whiteboard
                socket={socket}
                studentId={selectedStudent}
                classCode={classCode}
                isTeacher={true}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {students.map((student) => (
              <Card key={student.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <Whiteboard
                    socket={socket}
                    studentId={student.id}
                    classCode={classCode}
                    isTeacher={true}
                    onBoardClick={() => setSelectedStudent(student.id)}
                  />
                  <p className="mt-2 text-center text-sm text-muted-foreground">
                    {student.displayName}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-8 bg-background">
      <Card className="mb-6">
        <CardContent className="p-6">
          <h2 className="text-2xl font-bold text-foreground">Class Code: {classCode}</h2>
          <p className="text-muted-foreground">Your Name: {displayName}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <Whiteboard socket={socket} studentId={studentId} classCode={classCode} />
        </CardContent>
      </Card>
    </div>
  );
} 