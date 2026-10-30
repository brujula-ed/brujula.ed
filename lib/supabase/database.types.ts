export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ai_usage: {
        Row: {
          created_at: string
          id: string
          route: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          route: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          route?: string
          user_id?: string
        }
        Relationships: []
      }
      concept_cards: {
        Row: {
          application: string
          concept_id: string
          created_at: string
          source: string
          status: string
          subject_id: string
          why_it_matters: string
        }
        Insert: {
          application: string
          concept_id: string
          created_at?: string
          source?: string
          status?: string
          subject_id: string
          why_it_matters: string
        }
        Update: {
          application?: string
          concept_id?: string
          created_at?: string
          source?: string
          status?: string
          subject_id?: string
          why_it_matters?: string
        }
        Relationships: [
          {
            foreignKeyName: "concept_cards_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: true
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concept_cards_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      concept_resources: {
        Row: {
          added_by: string
          concept_id: string
          created_at: string
          id: string
          kind: string
          link_check: string
          source: string
          status: string
          subject_id: string
          title: string
          url: string
        }
        Insert: {
          added_by: string
          concept_id: string
          created_at?: string
          id?: string
          kind: string
          link_check: string
          source: string
          status?: string
          subject_id: string
          title: string
          url: string
        }
        Update: {
          added_by?: string
          concept_id?: string
          created_at?: string
          id?: string
          kind?: string
          link_check?: string
          source?: string
          status?: string
          subject_id?: string
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "concept_resources_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concept_resources_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      concepts: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          prerequisite_ids: string[]
          status: string
          subject_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          prerequisite_ids?: string[]
          status?: string
          subject_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          prerequisite_ids?: string[]
          status?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "concepts_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_answers: {
        Row: {
          attempt_id: string
          concept: string
          concept_id: string | null
          correct_index: number
          created_at: string | null
          id: string
          is_correct: boolean
          question_id: string
          selected_index: number
          stage: string
        }
        Insert: {
          attempt_id: string
          concept: string
          concept_id?: string | null
          correct_index: number
          created_at?: string | null
          id?: string
          is_correct: boolean
          question_id: string
          selected_index: number
          stage: string
        }
        Update: {
          attempt_id?: string
          concept?: string
          concept_id?: string | null
          correct_index?: number
          created_at?: string | null
          id?: string
          is_correct?: boolean
          question_id?: string
          selected_index?: number
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_answers_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_attempts: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          subject: string
          subject_id: string | null
          topic: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          subject: string
          subject_id?: string | null
          topic: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          subject?: string
          subject_id?: string | null
          topic?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_attempts_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      document_chunks: {
        Row: {
          content: string
          content_tsv: unknown
          created_at: string | null
          document_id: string
          embedding: string | null
          id: string
          page_end: number | null
          page_start: number | null
          position: number
          section: string | null
          subject_id: string
        }
        Insert: {
          content: string
          content_tsv?: unknown
          created_at?: string | null
          document_id: string
          embedding?: string | null
          id?: string
          page_end?: number | null
          page_start?: number | null
          position: number
          section?: string | null
          subject_id: string
        }
        Update: {
          content?: string
          content_tsv?: unknown
          created_at?: string | null
          document_id?: string
          embedding?: string | null
          id?: string
          page_end?: number | null
          page_start?: number | null
          position?: number
          section?: string | null
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "subject_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_chunks_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          created_at: string | null
          id: string
          student_id: string
          subject_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          student_id: string
          subject_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          student_id?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_spans: {
        Row: {
          chunk_id: string
          concept_id: string
          created_at: string
          document_id: string
          id: string
          page_end: number | null
          page_start: number | null
          question_id: string | null
          quote: string
          section: string | null
          subject_id: string
        }
        Insert: {
          chunk_id: string
          concept_id: string
          created_at?: string
          document_id: string
          id?: string
          page_end?: number | null
          page_start?: number | null
          question_id?: string | null
          quote: string
          section?: string | null
          subject_id: string
        }
        Update: {
          chunk_id?: string
          concept_id?: string
          created_at?: string
          document_id?: string
          id?: string
          page_end?: number | null
          page_start?: number | null
          question_id?: string | null
          quote?: string
          section?: string | null
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_spans_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: false
            referencedRelation: "document_chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_spans_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_spans_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "subject_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_spans_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_spans_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      pilot_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string | null
          name: string
          status: string
          university: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message?: string | null
          name: string
          status?: string
          university: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          name?: string
          status?: string
          university?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      questions: {
        Row: {
          concept_id: string
          correct_index: number
          created_at: string | null
          id: string
          options: Json
          prompt: string
          status: string
          subject_id: string
        }
        Insert: {
          concept_id: string
          correct_index: number
          created_at?: string | null
          id?: string
          options: Json
          prompt: string
          status?: string
          subject_id: string
        }
        Update: {
          concept_id?: string
          correct_index?: number
          created_at?: string | null
          id?: string
          options?: Json
          prompt?: string
          status?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      self_regulation_responses: {
        Row: {
          answers: Json
          created_at: string
          id: string
          instrument_version: string
          user_id: string
        }
        Insert: {
          answers: Json
          created_at?: string
          id?: string
          instrument_version: string
          user_id?: string
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: string
          instrument_version?: string
          user_id?: string
        }
        Relationships: []
      }
      self_regulation_shares: {
        Row: {
          created_at: string
          student_id: string
          subject_id: string
        }
        Insert: {
          created_at?: string
          student_id?: string
          subject_id: string
        }
        Update: {
          created_at?: string
          student_id?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "self_regulation_shares_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_documents: {
        Row: {
          file_name: string
          id: string
          storage_path: string
          subject_id: string
          uploaded_at: string | null
        }
        Insert: {
          file_name: string
          id?: string
          storage_path: string
          subject_id: string
          uploaded_at?: string | null
        }
        Update: {
          file_name?: string
          id?: string
          storage_path?: string
          subject_id?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subject_documents_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          class_code: string
          created_at: string | null
          id: string
          name: string
          teacher_id: string
          topic: string
        }
        Insert: {
          class_code: string
          created_at?: string | null
          id?: string
          name: string
          teacher_id: string
          topic: string
        }
        Update: {
          class_code?: string
          created_at?: string | null
          id?: string
          name?: string
          teacher_id?: string
          topic?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_ai_quota: { Args: { p_route: string }; Returns: boolean }
      find_subject_id_by_code: { Args: { input_code: string }; Returns: string }
      get_diagnostic_questions: {
        Args: { p_subject_id: string }
        Returns: {
          concept_description: string
          concept_id: string
          concept_name: string
          id: string
          last_answered_at: string
          options: Json
          prompt: string
          times_answered: number
        }[]
      }
      is_enrolled: { Args: { target_subject_id: string }; Returns: boolean }
      is_subject_owner: {
        Args: { target_subject_id: string }
        Returns: boolean
      }
      normalize_quote_text: { Args: { t: string }; Returns: string }
      search_chunks: {
        Args: {
          p_limit?: number
          p_query: string
          p_query_embedding: string
          p_subject_id: string
        }
        Returns: {
          content: string
          document_id: string
          id: string
          page_end: number
          page_start: number
          position: number
          score: number
          section: string
        }[]
      }
      self_regulation_class_summary: {
        Args: { p_subject_id: string }
        Returns: {
          knowledge_avg: number
          knowledge_high: number
          knowledge_low: number
          knowledge_mid: number
          regulation_avg: number
          regulation_high: number
          regulation_low: number
          regulation_mid: number
          respondents: number
        }[]
      }
      self_regulation_scores: {
        Args: { p_answers: Json }
        Returns: Record<string, unknown>
      }
      self_regulation_shared_result: {
        Args: { p_student_id: string; p_subject_id: string }
        Returns: {
          answered_at: string
          knowledge_avg: number
          regulation_avg: number
        }[]
      }
      submit_answer: {
        Args: {
          p_attempt_id: string
          p_question_id: string
          p_selected_index: number
          p_stage: string
        }
        Returns: boolean
      }
      submit_self_regulation: {
        Args: { p_answers: Json; p_version: string }
        Returns: string
      }
    }
    Enums: {
      user_role: "estudiante" | "docente"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      user_role: ["estudiante", "docente"],
    },
  },
} as const
