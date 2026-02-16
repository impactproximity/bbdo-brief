'use client';

import React, { useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Bot, User } from 'lucide-react';

export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

interface ChatInterfaceProps {
    messages: Message[];
}

export function ChatInterface({ messages }: ChatInterfaceProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    return (
        <ScrollArea className="h-[500px] w-full pr-4">
            <div className="space-y-4">
                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={cn(
                            "flex w-full items-start gap-2",
                            message.role === 'user' ? "justify-end" : "justify-start"
                        )}
                    >
                        {message.role === 'assistant' && (
                            <Avatar className="h-8 w-8 border">
                                <AvatarFallback className="bg-primary/10"><Bot size={16} /></AvatarFallback>
                            </Avatar>
                        )}

                        <Card
                            className={cn(
                                "max-w-[80%] p-3 text-sm",
                                message.role === 'user'
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted"
                            )}
                        >
                            {message.content}
                        </Card>

                        {message.role === 'user' && (
                            <Avatar className="h-8 w-8 border">
                                <AvatarFallback className="bg-secondary"><User size={16} /></AvatarFallback>
                            </Avatar>
                        )}
                    </div>
                ))}
                <div ref={scrollRef} />
            </div>
        </ScrollArea>
    );
}
