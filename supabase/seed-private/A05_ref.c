#include <stdio.h>

// 사칙연산 함수
int add(int a, int b) {
    return a + b;
}

int sub(int a, int b) {
    return a - b;
}

int mul(int a, int b) {
    return a * b;
}

int div(int a, int b) {
    return a / b;
}

int main(void)
{
    int num1, num2;

    // 함수 포인터 배열
    int (*fp[4])(int, int) = { add, sub, mul, div };

    printf("두 정수 입력: ");
    scanf("%d %d", &num1, &num2);

    printf("덧셈 결과: %d\n", fp[0](num1, num2));
    printf("뺄셈 결과: %d\n", fp[1](num1, num2));
    printf("곱셈 결과: %d\n", fp[2](num1, num2));
    printf("나눗셈 결과: %d\n", fp[3](num1, num2));

    return 0;
}
