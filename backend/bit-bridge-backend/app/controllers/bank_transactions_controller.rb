# frozen_string_literal: true

class BankTransactionsController < ApplicationController
  before_action :set_bank_transaction, only: %i[show update destroy]

  # GET /bank_transactions
  def index
    @bank_transactions = BankTransaction.all

    render json: @bank_transactions
  end

  # GET /bank_transactions/1
  def show
    render json: @bank_transaction
  end

  # POST /bank_transactions
  def create
    @bank_transaction = BankTransaction.new(bank_transaction_params)

    if @bank_transaction.save
      render json: @bank_transaction, status: :created, location: @bank_transaction
    else
      render json: @bank_transaction.errors, status: :unprocessable_entity
    end
  end

  # PATCH/PUT /bank_transactions/1
  def update
    if @bank_transaction.update(bank_transaction_params)
      render json: @bank_transaction
    else
      render json: @bank_transaction.errors, status: :unprocessable_entity
    end
  end

  # DELETE /bank_transactions/1
  def destroy
    @bank_transaction.destroy!
  end

  private

  # Use callbacks to share common setup or constraints between actions.
  def set_bank_transaction
    @bank_transaction = BankTransaction.find(params[:id])
  end

  # Only allow a list of trusted parameters through.
  def bank_transaction_params
    params.require(:bank_transaction).permit(:description, :amount, :recipient_id, :trasaction_id, :account_id)
  end
end
