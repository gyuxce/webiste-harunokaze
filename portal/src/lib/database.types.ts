export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          whatsapp: string | null;
          birth_date: string | null;
          program_interest: string | null;
          city: string | null;
          role: "participant" | "admin" | "psychologist";
          notification_email: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          whatsapp?: string | null;
          birth_date?: string | null;
          program_interest?: string | null;
          city?: string | null;
          role?: "participant" | "admin" | "psychologist";
          notification_email?: string | null;
        };
        Update: {
          full_name?: string;
          whatsapp?: string | null;
          birth_date?: string | null;
          program_interest?: string | null;
          city?: string | null;
          role?: "participant" | "admin" | "psychologist";
          notification_email?: string | null;
        };
        Relationships: [];
      };
      assessment_invoices: {
        Row: {
          id: string;
          user_id: string;
          invoice_number: string;
          amount: number;
          currency: "IDR";
          description: string;
          status: "issued" | "paid" | "cancelled";
          due_date: string | null;
          issued_at: string;
          paid_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          invoice_number: string;
          amount: number;
          currency?: "IDR";
          description?: string;
          status?: "issued" | "paid" | "cancelled";
          due_date?: string | null;
          issued_at?: string;
          paid_at?: string | null;
          created_by?: string | null;
        };
        Update: {
          amount?: number;
          description?: string;
          status?: "issued" | "paid" | "cancelled";
          due_date?: string | null;
          issued_at?: string;
          paid_at?: string | null;
        };
        Relationships: [];
      };
      assessment_attempts: {
        Row: {
          id: string;
          user_id: string;
          assessment_type: "pimsleur" | "cfit" | "papikostik";
          status: "in_progress" | "completed";
          duration_seconds: number;
          started_at: string;
          deadline_at: string;
          step_started_at: string;
          step_deadline_at: string | null;
          current_step: number;
          answers: Json;
          last_saved_at: string;
          completed_at: string | null;
          timed_out: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          assessment_type: "pimsleur" | "cfit" | "papikostik";
          status?: "in_progress" | "completed";
          duration_seconds: number;
          started_at?: string;
          deadline_at: string;
          step_started_at?: string;
          step_deadline_at?: string | null;
          current_step?: number;
          answers?: Json;
          last_saved_at?: string;
          completed_at?: string | null;
          timed_out?: boolean;
        };
        Update: {
          status?: "in_progress" | "completed";
          deadline_at?: string;
          step_started_at?: string;
          step_deadline_at?: string | null;
          current_step?: number;
          answers?: Json;
          last_saved_at?: string;
          completed_at?: string | null;
          timed_out?: boolean;
        };
        Relationships: [];
      };
      pimsleur_results: {
        Row: {
          id: string;
          user_id: string;
          answers: Json;
          score_section2: number;
          score_section3: number;
          score_section4: number;
          score_section5: number;
          score_section6: number;
          score_verbal: number;
          score_audio: number;
          score_total: number;
          grade: string;
          grade_label: string;
          status_label: string;
          recommendation: string;
          duration_seconds: number | null;
          started_at: string;
          completed_at: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          answers?: Json;
          score_section2: number;
          score_section3: number;
          score_section4: number;
          score_section5: number;
          score_section6: number;
          score_verbal: number;
          score_audio: number;
          score_total: number;
          grade: string;
          grade_label: string;
          status_label: string;
          recommendation: string;
          duration_seconds?: number | null;
          started_at?: string;
          completed_at?: string;
        };
        Update: {
          answers?: Json;
          score_total?: number;
          grade?: string;
        };
        Relationships: [];
      };
      assessment_final_reviews: {
        Row: {
          id: string;
          user_id: string;
          psychologist_interpretation: string | null;
          participant_summary: string | null;
          qc_notes: string | null;
          status: "pending_psychologist" | "pending_qc" | "approved";
          approved_by: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          psychologist_interpretation?: string | null;
          participant_summary?: string | null;
          qc_notes?: string | null;
          status?: "pending_psychologist" | "pending_qc" | "approved";
          approved_by?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          psychologist_interpretation?: string | null;
          participant_summary?: string | null;
          qc_notes?: string | null;
          status?: "pending_psychologist" | "pending_qc" | "approved";
          approved_by?: string | null;
          approved_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      cfit_results: {
        Row: {
          id: string;
          user_id: string;
          answers: Json;
          raw_subtest1: number | null;
          raw_subtest2: number | null;
          raw_subtest3: number | null;
          raw_subtest4: number | null;
          raw_total: number | null;
          iq: number | null;
          category: string | null;
          age_years: number | null;
          age_months: number | null;
          norm_code: string | null;
          duration_seconds: number | null;
          started_at: string;
          completed_at: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          answers?: Json;
          raw_subtest1?: number | null;
          raw_subtest2?: number | null;
          raw_subtest3?: number | null;
          raw_subtest4?: number | null;
          raw_total?: number | null;
          iq?: number | null;
          category?: string | null;
          age_years?: number | null;
          age_months?: number | null;
          norm_code?: string | null;
          duration_seconds?: number | null;
          started_at?: string;
          completed_at?: string;
        };
        Update: {
          answers?: Json;
          raw_subtest1?: number | null;
          raw_subtest2?: number | null;
          raw_subtest3?: number | null;
          raw_subtest4?: number | null;
          raw_total?: number | null;
          iq?: number | null;
          category?: string | null;
          age_years?: number | null;
          age_months?: number | null;
          norm_code?: string | null;
          duration_seconds?: number | null;
        };
        Relationships: [];
      };
      papikostik_results: {
        Row: {
          id: string;
          user_id: string;
          answers: Json;
          scores: Json;
          analyses: Json;
          total_top: number | null;
          total_bottom: number | null;
          total_all: number | null;
          is_complete_pattern: boolean | null;
          duration_seconds: number | null;
          review_status: "pending" | "reviewed";
          psychologist_notes: string | null;
          final_summary: string | null;
          started_at: string;
          completed_at: string;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          answers?: Json;
          scores?: Json;
          analyses?: Json;
          total_top?: number | null;
          total_bottom?: number | null;
          total_all?: number | null;
          is_complete_pattern?: boolean | null;
          duration_seconds?: number | null;
          review_status?: "pending" | "reviewed";
          psychologist_notes?: string | null;
          final_summary?: string | null;
          started_at?: string;
          completed_at?: string;
          reviewed_at?: string | null;
        };
        Update: {
          answers?: Json;
          scores?: Json;
          analyses?: Json;
          total_top?: number | null;
          total_bottom?: number | null;
          total_all?: number | null;
          is_complete_pattern?: boolean | null;
          duration_seconds?: number | null;
          review_status?: "pending" | "reviewed";
          psychologist_notes?: string | null;
          final_summary?: string | null;
          reviewed_at?: string | null;
        };
        Relationships: [];
      };
      user_progress: {
        Row: {
          id: string;
          user_id: string;
          registration_status: string;
          payment_status: "pending" | "paid" | "verified";
          language_test_status: "locked" | "available" | "in_progress" | "completed";
          character_test_status: "locked" | "available" | "in_progress" | "completed";
          cfit_test_status: "locked" | "available" | "in_progress" | "completed";
          papikostik_test_status: "locked" | "available" | "in_progress" | "completed";
          final_review_status: "locked" | "pending_psychologist" | "pending_qc" | "approved";
          result_status: "locked" | "available" | "completed";
          consultation_status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          registration_status?: string;
          payment_status?: string;
          language_test_status?: string;
          character_test_status?: string;
          cfit_test_status?: string;
          papikostik_test_status?: string;
          final_review_status?: string;
          result_status?: string;
          consultation_status?: string;
        };
        Update: {
          registration_status?: string;
          payment_status?: string;
          language_test_status?: string;
          character_test_status?: string;
          cfit_test_status?: string;
          papikostik_test_status?: string;
          final_review_status?: string;
          result_status?: string;
          consultation_status?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          user_id: string;
          invoice_id: string | null;
          order_id: string;
          amount: number;
          currency: "IDR";
          status: string;
          midtrans_transaction_id: string | null;
          provider: string;
          provider_reference_id: string | null;
          payment_url: string | null;
          raw_payload: Json | null;
          payment_type: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          invoice_id?: string | null;
          order_id: string;
          amount: number;
          currency?: "IDR";
          status?: string;
          midtrans_transaction_id?: string | null;
          provider?: string;
          provider_reference_id?: string | null;
          payment_url?: string | null;
          raw_payload?: Json | null;
          payment_type?: string;
        };
        Update: {
          invoice_id?: string | null;
          amount?: number;
          currency?: "IDR";
          status?: string;
          midtrans_transaction_id?: string | null;
          provider?: string;
          provider_reference_id?: string | null;
          payment_url?: string | null;
          raw_payload?: Json | null;
        };
        Relationships: [];
      };
      test_questions: {
        Row: {
          id: string;
          test_type: "language" | "character" | "cfit" | "papikostik";
          question_text: string;
          options: { label: string; value: string }[];
          correct_answer: string;
          order_index: number;
          active: boolean;
          created_at?: string;
        };
        Insert: {
          test_type: string;
          question_text: string;
          options?: Json;
          correct_answer: string;
          order_index?: number;
          active?: boolean;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      test_sessions: {
        Row: {
          id: string;
          user_id: string;
          test_type: string;
          started_at: string;
          completed_at: string | null;
          score: number | null;
          passed: boolean | null;
        };
        Insert: {
          user_id: string;
          test_type: string;
          started_at?: string;
          completed_at?: string | null;
          score?: number | null;
          passed?: boolean | null;
        };
        Update: {
          completed_at?: string | null;
          score?: number | null;
          passed?: boolean | null;
        };
        Relationships: [];
      };
      test_answers: {
        Row: {
          id: string;
          session_id: string;
          question_id: string;
          answer: string | null;
          is_correct: boolean | null;
        };
        Insert: {
          session_id: string;
          question_id: string;
          answer?: string | null;
          is_correct?: boolean | null;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      certificates: {
        Row: {
          id: string;
          user_id: string;
          certificate_code: string;
          score: number;
          recommendation: string;
          issued_at: string;
        };
        Insert: {
          user_id: string;
          certificate_code: string;
          score: number;
          recommendation: string;
          issued_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      start_assessment_attempt: {
        Args: {
          p_assessment_type: "pimsleur" | "cfit" | "papikostik";
          p_duration_seconds: number;
          p_step_duration_seconds?: number | null;
        };
        Returns: {
          id: string;
          assessment_type: "pimsleur" | "cfit" | "papikostik";
          status: "in_progress" | "completed";
          duration_seconds: number;
          started_at: string;
          deadline_at: string;
          step_started_at: string;
          step_deadline_at: string | null;
          current_step: number;
          answers: Json;
          last_saved_at: string;
          completed_at: string | null;
          timed_out: boolean;
        }[];
      };
      save_assessment_attempt: {
        Args: {
          p_attempt_id: string;
          p_answers: Json;
          p_current_step?: number;
        };
        Returns: {
          id: string;
          status: "in_progress" | "completed";
          deadline_at: string;
          step_deadline_at: string | null;
          current_step: number;
          answers: Json;
          last_saved_at: string;
          completed_at: string | null;
          timed_out: boolean;
        }[];
      };
      advance_assessment_attempt: {
        Args: {
          p_attempt_id: string;
          p_current_step: number;
          p_step_duration_seconds: number;
        };
        Returns: {
          id: string;
          status: "in_progress" | "completed";
          deadline_at: string;
          step_started_at: string;
          step_deadline_at: string | null;
          current_step: number;
          answers: Json;
          last_saved_at: string;
          completed_at: string | null;
          timed_out: boolean;
        }[];
      };
      finish_assessment_attempt: {
        Args: {
          p_attempt_id: string;
          p_answers: Json;
          p_current_step?: number;
        };
        Returns: {
          id: string;
          status: "in_progress" | "completed";
          deadline_at: string;
          current_step: number;
          answers: Json;
          last_saved_at: string;
          completed_at: string | null;
          timed_out: boolean;
        }[];
      };
      admin_list_assessment_invoices: {
        Args: Record<string, never>;
        Returns: {
          user_id: string;
          full_name: string;
          email: string | null;
          whatsapp: string | null;
          city: string | null;
          program_interest: string | null;
          registered_at: string;
          invoice_id: string | null;
          invoice_number: string | null;
          amount: number | null;
          currency: "IDR" | null;
          description: string | null;
          invoice_status: "issued" | "paid" | "cancelled" | null;
          due_date: string | null;
          issued_at: string | null;
          paid_at: string | null;
          progress_payment_status: "pending" | "paid" | "verified";
          last_payment_status: string | null;
          last_payment_at: string | null;
        }[];
      };
      admin_update_participant_program_interest: {
        Args: {
          p_user_id: string;
          p_program_interest: string;
        };
        Returns: {
          user_id: string;
          program_interest: string;
        }[];
      };
      admin_upsert_assessment_invoice: {
        Args: {
          p_user_id: string;
          p_amount: number;
          p_description: string;
          p_due_date: string | null;
        };
        Returns: Database["public"]["Tables"]["assessment_invoices"]["Row"];
      };
      admin_list_participant_test_progress: {
        Args: Record<string, never>;
        Returns: {
          user_id: string;
          full_name: string;
          email: string | null;
          whatsapp: string | null;
          city: string | null;
          payment_status: string;
          language_test_status: string;
          cfit_test_status: string;
          papikostik_test_status: string;
          papikostik_is_complete_pattern: boolean | null;
        }[];
      };
      admin_reset_assessment_attempt: {
        Args: {
          p_user_id: string;
          p_assessment_type: "pimsleur" | "cfit" | "papikostik";
        };
        Returns: undefined;
      };
      admin_reopen_papikostik_attempt: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
      ensure_own_assessment_invoice: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          invoice_number: string;
          amount: number;
          currency: "IDR";
          description: string;
          status: "issued" | "paid";
          due_date: string | null;
          issued_at: string;
          paid_at: string | null;
        }[];
      };
      get_own_assessment_invoice: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          invoice_number: string;
          amount: number;
          currency: "IDR";
          description: string;
          status: "issued" | "paid";
          due_date: string | null;
          issued_at: string;
          paid_at: string | null;
        }[];
      };
      admin_list_pimsleur_results: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          user_id: string;
          score_section2: number;
          score_section3: number;
          score_section4: number;
          score_section5: number;
          score_section6: number;
          score_verbal: number;
          score_audio: number;
          score_total: number;
          grade: string;
          grade_label: string;
          status_label: string;
          recommendation: string;
          duration_seconds: number | null;
          completed_at: string;
          full_name: string;
          email: string | null;
          whatsapp: string | null;
          city: string | null;
        }[];
      };
      admin_get_pimsleur_detail: {
        Args: { p_user_id: string };
        Returns: {
          id: string;
          user_id: string;
          answers: Json;
          score_section2: number;
          score_section3: number;
          score_section4: number;
          score_section5: number;
          score_section6: number;
          score_verbal: number;
          score_audio: number;
          score_total: number;
          grade: string;
          grade_label: string;
          status_label: string;
          recommendation: string;
          duration_seconds: number | null;
          completed_at: string;
          full_name: string;
          email: string | null;
          whatsapp: string | null;
          city: string | null;
        }[];
      };
      admin_list_cfit_results: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          user_id: string;
          raw_subtest1: number | null;
          raw_subtest2: number | null;
          raw_subtest3: number | null;
          raw_subtest4: number | null;
          raw_total: number | null;
          iq: number | null;
          category: string | null;
          age_years: number | null;
          age_months: number | null;
          norm_code: string | null;
          duration_seconds: number | null;
          completed_at: string;
          full_name: string;
          email: string | null;
          whatsapp: string | null;
          city: string | null;
          birth_date: string | null;
        }[];
      };
      admin_get_cfit_detail: {
        Args: { p_user_id: string };
        Returns: {
          id: string;
          user_id: string;
          answers: Json;
          raw_subtest1: number | null;
          raw_subtest2: number | null;
          raw_subtest3: number | null;
          raw_subtest4: number | null;
          raw_total: number | null;
          iq: number | null;
          category: string | null;
          age_years: number | null;
          age_months: number | null;
          norm_code: string | null;
          duration_seconds: number | null;
          completed_at: string;
          full_name: string;
          email: string | null;
          whatsapp: string | null;
          city: string | null;
          birth_date: string | null;
        }[];
      };
      admin_list_papikostik_results: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          user_id: string;
          total_top: number | null;
          total_bottom: number | null;
          total_all: number | null;
          is_complete_pattern: boolean | null;
          review_status: "pending" | "reviewed";
          completed_at: string;
          reviewed_at: string | null;
          full_name: string;
          email: string | null;
          whatsapp: string | null;
          city: string | null;
        }[];
      };
      admin_get_papikostik_detail: {
        Args: { p_user_id: string };
        Returns: {
          id: string;
          user_id: string;
          answers: Json;
          scores: Json;
          analyses: Json;
          total_top: number | null;
          total_bottom: number | null;
          total_all: number | null;
          is_complete_pattern: boolean | null;
          review_status: "pending" | "reviewed";
          psychologist_notes: string | null;
          final_summary: string | null;
          duration_seconds: number | null;
          completed_at: string;
          reviewed_at: string | null;
          full_name: string;
          email: string | null;
          whatsapp: string | null;
          city: string | null;
        }[];
      };
      psychologist_list_review_queue: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          user_id: string;
          total_top: number | null;
          total_bottom: number | null;
          total_all: number | null;
          is_complete_pattern: boolean | null;
          review_status: "pending" | "reviewed";
          completed_at: string;
          reviewed_at: string | null;
          final_review_status: string | null;
          full_name: string;
          email: string | null;
          whatsapp: string | null;
          city: string | null;
        }[];
      };
      admin_get_final_assessment: {
        Args: { p_user_id: string };
        Returns: {
          user_id: string;
          full_name: string;
          email: string | null;
          whatsapp: string | null;
          city: string | null;
          pimsleur_score_total: number | null;
          pimsleur_grade: string | null;
          cfit_raw_total: number | null;
          cfit_iq: number | null;
          cfit_category: string | null;
          papi_total_all: number | null;
          papi_review_status: string | null;
          review_id: string | null;
          psychologist_interpretation: string | null;
          participant_summary: string | null;
          qc_notes: string | null;
          final_review_status: "locked" | "pending_psychologist" | "pending_qc" | "approved";
          approved_at: string | null;
          certificate_code: string | null;
        }[];
      };
      admin_upsert_final_review: {
        Args: {
          p_user_id: string;
          p_psychologist_interpretation: string;
          p_participant_summary: string;
          p_qc_notes: string;
        };
        Returns: {
          id: string;
          user_id: string;
          psychologist_interpretation: string | null;
          participant_summary: string | null;
          qc_notes: string | null;
          status: "pending_psychologist" | "pending_qc" | "approved";
          approved_by: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      admin_publish_assessment: {
        Args: { p_user_id: string };
        Returns: {
          certificate_id: string;
          certificate_code: string;
        }[];
      };
      psychologist_save_papikostik_review: {
        Args: { p_user_id: string; p_notes: string };
        Returns: {
          user_id: string;
          review_status: string;
          psychologist_notes: string | null;
          reviewed_at: string | null;
        }[];
      };
      get_own_papikostik_status: {
        Args: Record<string, never>;
        Returns: {
          total_all: number | null;
          completed_at: string;
          review_status: "pending" | "reviewed" | "approved";
          final_summary: string | null;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type UserProgress = Database["public"]["Tables"]["user_progress"]["Row"];
export type AssessmentInvoice = Database["public"]["Tables"]["assessment_invoices"]["Row"];
export type PimsleurResult = Database["public"]["Tables"]["pimsleur_results"]["Row"];
export type CfitResult = Database["public"]["Tables"]["cfit_results"]["Row"];
export type PapikostikResult = Database["public"]["Tables"]["papikostik_results"]["Row"];
export type AssessmentFinalReview = Database["public"]["Tables"]["assessment_final_reviews"]["Row"];

export const PROGRESS_STEPS = [
  { key: "registration", label: "Registrasi & akun peserta", field: "registration_status" as const },
  { key: "payment", label: "Verifikasi pembayaran", field: "payment_status" as const },
  { key: "language", label: "Tes Pimsleur (bahasa)", field: "language_test_status" as const },
  { key: "cfit", label: "CFIT", field: "cfit_test_status" as const },
  { key: "papikostik", label: "PAPI Kostick", field: "papikostik_test_status" as const },
  { key: "result", label: "Hasil asesmen", field: "result_status" as const },
  { key: "certificate", label: "Sertifikat pemetaan", field: "result_status" as const },
] as const;
